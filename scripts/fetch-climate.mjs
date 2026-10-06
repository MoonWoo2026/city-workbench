import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const DATA = JSON.parse(readFileSync(resolve(__dirname, '../src/data/cities_full.json'), 'utf8'))
const CACHE_DIR = resolve(__dirname, '.geo-cache/climate')
mkdirSync(CACHE_DIR, { recursive: true })

const BASE = 'https://archive-api.open-meteo.com/v1/archive'

// 逐月均值 → 五年同月平均 → 最冷月/最热月/年降水
async function fetchClimate(city) {
  const cache = resolve(CACHE_DIR, `${city.id}.json`)
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))

  const url = `${BASE}?latitude=${city.lat}&longitude=${city.lng}&start_date=2021-01-01&end_date=2025-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`

  // 重试 3 次，429 时退避
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = (attempt + 1) * 8
      console.log(`${city.name} 429，等待 ${wait}s 后重试`)
      await new Promise(r => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok) throw new Error(`${city.name}: ${res.status}`)
    const data = await res.json()
    return processClimate(city, data)
  }
  throw new Error(`${city.name}: 429 too many retries`)
}

function processClimate(city, data) {
  const cache = resolve(CACHE_DIR, `${city.id}.json`)
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

  const coldest = mmeans.reduce((a, b) => a.temp < b.temp ? a : b)
  const hottest = mmeans.reduce((a, b) => a.temp > b.temp ? a : b)
  const annualPrecip = mmeans.reduce((s, m) => s + m.precip, 0)

  const result = {
    coldest_month: { month: coldest.month, temp: coldest.temp },
    hottest_month: { month: hottest.month, temp: hottest.temp },
    annual_precip: annualPrecip,
  }

  writeFileSync(cache, JSON.stringify(result))
  return result
}

const MONTH_LABEL = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

async function main() {
  const total = DATA.cities.length
  let done = 0, err = 0
  const BATCH = 5
  for (let i = 0; i < total; i += BATCH) {
    const batch = DATA.cities.slice(i, i + BATCH)
    await Promise.all(batch.map(async c => {
      try {
        await fetchClimate(c)
        done++
      } catch (e) {
        console.error(c.name, e.message)
        err++
      }
    }))
    if (done % 50 === 0 || i + BATCH >= total) {
      console.log(`进度 ${done}/${total}${err ? ` 失败${err}` : ''}`)
    }
    await new Promise(r => setTimeout(r, 2500)) // 限速：每批 2.5s ≈ 2 req/s
  }
  console.log(`完成 ${done}/${total}${err ? `，失败 ${err}` : ''}`)
}

main()
