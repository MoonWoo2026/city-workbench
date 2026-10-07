// PM2.5 周均抓取：Open-Meteo Air Quality API（数据源 Copernicus CAMS），免费无 key
//   - 取近 7 天逐小时 pm2_5，本地平均成周均值（μg/m³）
//   - 多坐标批量（30/批），429 退避重试；单城结果缓存于 .geo-cache/pm25（按 UTC 日期，同日续跑不重复请求）
//   - 产出 scripts/pm25.json：{ updated, window_days, source, cities: { id: {v} } }
//   - 纯 Node 全局 fetch，无第三方依赖，可直接在 GitHub Actions 跑
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(__dirname, '../src/data/cities_full.json')
const OUT_PATH = resolve(__dirname, 'pm25.json')
const CACHE_DIR = resolve(__dirname, '.geo-cache/pm25')
mkdirSync(CACHE_DIR, { recursive: true })

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const CHUNK = 30
const GAP_MS = 5000
const TODAY = new Date().toISOString().slice(0, 10) // UTC 日期，作为本次抓取批次标识

const dataset = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const cities = dataset.cities.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number')
console.log(`城市 ${dataset.cities.length}，有坐标 ${cities.length}`)

// 逐小时序列 → 周均值；要求有效样本 ≥ 70%（118/168 小时）
function weeklyMean(hourly) {
  if (!hourly || !Array.isArray(hourly.pm2_5)) return null
  const vals = hourly.pm2_5.filter(v => typeof v === 'number' && Number.isFinite(v))
  if (vals.length < 168 * 0.7) return null
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.round(avg * 10) / 10
}

async function fetchBatch(chunk) {
  const lats = chunk.map(c => c.lat.toFixed(4)).join(',')
  const lngs = chunk.map(c => c.lng.toFixed(4)).join(',')
  const url = `${BASE}?latitude=${lats}&longitude=${lngs}&hourly=pm2_5&past_days=7&timezone=auto`
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url)
    if (res.status === 429 || res.status >= 500) {
      const wait = (attempt + 1) * 60
      console.log(`批次 ${res.status}，等待 ${wait}s 重试`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`batch HTTP ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : [data]
  }
  throw new Error('batch: 重试耗尽')
}

async function fetchChunk(chunk) {
  try {
    return await fetchBatch(chunk)
  } catch (e) {
    // 整批网络失败（偶发 socket 重置）→ 拆半重试，顺序保持与 chunk 对齐；拆到单城仍失败则上抛
    if (chunk.length <= 1) throw e
    const mid = Math.floor(chunk.length / 2)
    const a = await fetchChunk(chunk.slice(0, mid))
    const b = await fetchChunk(chunk.slice(mid))
    return [...a, ...b]
  }
}

async function main() {
  const results = new Map()
  let skipped = 0, failed = 0
  const todo = []
  for (const c of cities) {
    const fp = resolve(CACHE_DIR, `${c.id}.json`)
    if (existsSync(fp)) {
      try {
        const cached = JSON.parse(readFileSync(fp, 'utf8'))
        if (cached.date === TODAY && typeof cached.v === 'number') { results.set(c.id, cached.v); skipped++; continue }
      } catch { /* 缓存损坏则重抓 */ }
    }
    todo.push(c)
  }
  console.log(`同日缓存 ${skipped}，待抓 ${todo.length}`)

  let done = 0
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK)
    try {
      const arr = await fetchChunk(chunk)
      for (let j = 0; j < chunk.length; j++) {
        const v = weeklyMean(arr[j] && arr[j].hourly)
        if (v === null) { failed++; continue }
        results.set(chunk[j].id, v)
        writeFileSync(resolve(CACHE_DIR, `${chunk[j].id}.json`), JSON.stringify({ date: TODAY, v }))
        done++
      }
    } catch (e) {
      console.error(`批次失败（${chunk[0].name} 起 ${chunk.length} 城）:`, e.message)
      failed += chunk.length
    }
    console.log(`进度 ${done + skipped}/${cities.length}（新抓 ${done}，失败 ${failed}）`)
    if (i + CHUNK < todo.length) await new Promise(r => setTimeout(r, GAP_MS))
  }

  const out = {
    _comment: 'PM2.5 近7天日均值（逐小时平均），单位 μg/m³。数据源：Open-Meteo Air Quality API（Copernicus CAMS 大气监测），每周自动更新。',
    source: 'Open-Meteo Air Quality / Copernicus CAMS',
    updated: TODAY,
    window_days: 7,
    cities: Object.fromEntries([...results.entries()].sort().map(([id, v]) => [id, { v }])),
  }
  writeFileSync(OUT_PATH, JSON.stringify(out))
  console.log(`写入 ${OUT_PATH}：${results.size}/${cities.length} 城，updated=${TODAY}，失败 ${failed}`)
  if (failed > cities.length * 0.1) process.exit(1) // 失败超 10% 让 CI 报错
}

main()
