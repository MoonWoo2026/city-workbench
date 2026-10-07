// PM2.5 注入：读 scripts/pm25.json（fetch-pm25.mjs 产出），写回 src/data/cities_full.json
//   - c.pm25 = { v: 周均μg/m³, updated: 'YYYY-MM-DD' }，按城市 id 精确匹配
//   - c.pm25text 供 matchQuery 搜索（PM2.5 空气质量 优/良/污染…）
//   - 分级由前端 pm25Level(v) 实时计算，这里不落等级
import fs from 'node:fs'
import { pm25Level } from '../src/lib/constants.js'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const src = JSON.parse(fs.readFileSync('scripts/pm25.json', 'utf8'))
const srcCities = src.cities || {}

for (const c of dataset.cities) { delete c.pm25; delete c.pm25text }

let hit = 0
for (const c of dataset.cities) {
  const row = srcCities[c.id]
  if (!row || typeof row.v !== 'number') continue
  c.pm25 = { v: row.v, updated: src.updated }
  const level = pm25Level(row.v)
  // 搜索文本：数值 + 等级 + 口语词
  c.pm25text = [`PM2.5 ${row.v}`, '空气质量', level.label,
    level.key === 'good' ? '空气好 空气清新 适合呼吸' : '',
    /污染/.test(level.label) ? '雾霾 空气差 空气污染' : '',
  ].filter(Boolean).join(' ')
  hit++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`PM2.5 注入：${hit}/${dataset.cities.length}（updated=${src.updated}，数据源 ${src.source}）`)
