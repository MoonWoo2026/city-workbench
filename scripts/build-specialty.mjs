// 复旦版《2023年度中国医院专科声誉排行榜》专科强院注入
// 读 scripts/specialties-fudan.json（人工整理，含医院→城市归属），写回 src/data/cities_full.json：
//   - 顶层 specialties: { source, specs: { key: { name, alias, guides, list: [{rank,name,short,city,leader?}] } } }
//   - 每个有强院的城市 c.spec: [[specKey, rank, 医院短名], ...]（按 rank 升序）
//   - 每个有强院的城市 c.spectext: 专科名+疾病别名+医院短名+带头人姓名（供关键词搜索命中）
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const spec = JSON.parse(fs.readFileSync('scripts/specialties-fudan.json', 'utf8'))

const byName = new Map(dataset.cities.map(c => [c.name, c]))

// 清理旧注入（幂等）
for (const c of dataset.cities) { delete c.spec; delete c.spectext }

const specs = {}
const missing = new Set()
const leaderToks = new Map() // city → Set(带头人姓名)
let hospCount = 0
for (const s of spec.specs) {
  const list = []
  for (const h of s.hospitals) {
    const city = byName.get(h.city)
    if (!city) { missing.add(h.city); continue }
    list.push({ rank: h.rank, name: h.name, short: h.short, city: h.city, ...(h.leader ? { leader: h.leader } : {}) })
    ;(city.spec ||= []).push([s.key, h.rank, h.short])
    if (h.leader?.name) {
      if (!leaderToks.has(city)) leaderToks.set(city, new Set())
      leaderToks.get(city).add(h.leader.name)
    }
    hospCount++
  }
  list.sort((a, b) => a.rank - b.rank)
  specs[s.key] = { name: s.name, alias: s.alias || [], guides: s.guides || [], list }
}

let hostCities = 0
for (const c of dataset.cities) {
  if (!c.spec) continue
  hostCities++
  c.spec.sort((a, b) => a[1] - b[1])
  const toks = []
  for (const [k, , short] of c.spec) {
    const s = specs[k]
    toks.push(s.name, ...(s.alias || []), short)
  }
  toks.push(...(leaderToks.get(c) || []))
  c.spectext = [...new Set(toks)].join(' ')
}

dataset.specialties = { source: spec.source, specs }
fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`专科数: ${Object.keys(specs).length}，医院条目: ${hospCount}，覆盖城市: ${hostCities}`)
if (missing.size) console.log('⚠ 城市名未命中数据集:', [...missing].join('、'))
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
