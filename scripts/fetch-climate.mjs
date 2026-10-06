import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const DATA = JSON.parse(readFileSync(resolve(__dirname, '../src/data/cities_full.json'), 'utf8'))
const CACHE_DIR = resolve(__dirname, '.geo-cache/climate')
mkdirSync(CACHE_DIR, { recursive: true })

const BASE = 'https://archive-api.open-meteo.com/v1/archive'

// 单城逐日数据 → 五年同月平均 → 最冷月/最热月/年降水，写入缓存
function processClimate(city, data) {
  const temps = data.daily.temperature_2m_mean
  const precips = data.daily.precipitation_sum
  const dates = data.daily.time

  const monthly = {}
  for (let i = 0; i < dates.length; i++) {
    const m = dates[i].slice(0, 7)
    if (!monthly[m]) monthly[m] = { temps: [], precips: [] }
    monthly[m].temps.push(temps[i])
    monthly[m].precips.push(precips[i])
  }

  const monthAvgs = Object.entries(monthly).map(([m, v]) => ({
    monthKey: m.slice(5),
    temp: v.temps.reduce((a, b) => a + b, 0) / v.temps.length,
    precip: v.precips.reduce((a, b) => a + b, 0),
  }))

  const byMonth = {}
  for (const a of monthAvgs) {
    if (!byMonth[a.monthKey]) byMonth[a.monthKey] = { temps: [], precips: [] }
    byMonth[a.monthKey].temps.push(a.temp)
    byMonth[a.monthKey].precips.push(a.precip)
  }

  const mmeans = Object.entries(byMonth).map(([mm, v]) => ({
    month: parseInt(mm),
    temp: +(v.temps.reduce((a, b) => a + b, 0) / v.temps.length).toFixed(1),
    precip: Math.round(v.precips.reduce((a, b) => a + b, 0) / v.precips.length),
  }))

  const coldest = mmeans.reduce((a, b) => (a.temp < b.temp ? a : b))
  const hottest = mmeans.reduce((a, b) => (a.temp > b.temp ? a : b))
  const annualPrecip = mmeans.reduce((s, m) => s + m.precip, 0)

  const result = {
    coldest_month: { month: coldest.month, temp: coldest.temp },
    hottest_month: { month: hottest.month, temp: hottest.temp },
    annual_precip: annualPrecip,
  }
  writeFileSync(resolve(CACHE_DIR, `${city.id}.json`), JSON.stringify(result))
  return result
}

// 批量抓气候：Open-Meteo 支持一次请求带多个坐标（纬度/经度逗号分隔），返回数组。
// 2896 城 → 约 58 次请求，远低于限流阈值。
async function fetchBatch(cities) {
  const lats = cities.map(c => c.lat.toFixed(4)).join(',')
  const lngs = cities.map(c => c.lng.toFixed(4)).join(',')
  const url = `${BASE}?latitude=${lats}&longitude=${lngs}&start_date=2021-01-01&end_date=2025-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = (attempt + 1) * 60
      console.log(`批次 429，等待 ${wait}s 后重试`)
      await new Promise(r => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok) throw new Error(`batch: ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : [data]
  }
  throw new Error('batch: 429 too many retries')
}

async function main() {
  const total = DATA.cities.length
  const uncached = DATA.cities.filter(c => !existsSync(resolve(CACHE_DIR, `${c.id}.json`)))
  console.log(`总 ${total}，已缓存 ${total - uncached.length}，待抓 ${uncached.length}`)

  const CHUNK = 30
  let done = total - uncached.length
  let err = 0
  for (let i = 0; i < uncached.length; i += CHUNK) {
    const chunk = uncached.slice(i, i + CHUNK)
    try {
      const arr = await fetchBatch(chunk)
      for (let j = 0; j < chunk.length; j++) {
        if (!arr[j] || !arr[j].daily) { err++; continue }
        processClimate(chunk[j], arr[j])
        done++
      }
    } catch (e) {
      console.error(`批次失败（${chunk[0].name} 起 ${chunk.length} 城）:`, e.message)
      err += chunk.length
    }
    console.log(`进度 ${done}/${total}${err ? ` 失败${err}` : ''}`)
    await new Promise(r => setTimeout(r, 10000)) // 批间隔 10s，防 429
  }
  console.log(`完成 ${done}/${total}${err ? `，失败 ${err}` : ''}`)
}

main()
