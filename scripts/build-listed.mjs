// 上市公司注入：读 scripts/listed-companies.json，写回 src/data/cities_full.json
//   - 母城直接命中：c.listed / c.listedtext / c.listedsectors
//   - 县/区/县级市：继承母城上市公司（股东大会在母城召开，区县无独立意义）
//   - listedtext = 公司名 + 股票代码 + 交易所 + 板块 + 行业 + 通用词，供 matchQuery 搜索
//   - listedsectors = 母城所拥有的板块集合（['消费','科技','金融'] 的子集），供 listedMin 过滤
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const rSrc = JSON.parse(fs.readFileSync('scripts/listed-companies.json', 'utf8')).cities

const byName = new Map(dataset.cities.map(c => [c.name, c]))
const missing = Object.keys(rSrc).filter(k => !byName.has(k))
if (missing.length) {
  console.log('⚠ listed-companies.json 未命中数据集：', missing.join('、'))
}

const roots = dataset.cities.filter(c => !c.parent)
function resolveRoot(parent) {
  if (!parent) return null
  const head = parent.split(/[·\/]/)[0].trim()
  const hit = roots.find(c => c.name === head)
  if (hit) return hit
  const norm = s => s.replace(/(市|地区|盟|自治州|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '')
  const hn = norm(head)
  return roots.find(c => c.name === hn || head.startsWith(c.name) || c.name.startsWith(hn)) || null
}

// 清理旧字段
for (const c of dataset.cities) {
  delete c.listed
  delete c.listedtext
  delete c.listedsectors
}

let own = 0, inherited = 0, totalCompanies = 0
const sectorSet = new Set()
for (const c of dataset.cities) {
  const ownEntry = rSrc[c.name]
  const root = resolveRoot(c.parent)
  const rootEntry = root && rSrc[root.name]
  const entry = ownEntry || rootEntry
  if (!entry || !Array.isArray(entry) || !entry.length) continue
  c.listed = entry
  totalCompanies += entry.length
  // 搜索文本：公司名 + 代码 + 交易所 + 板块 + 行业 + 通用词
  const universal = '上市公司 A股 港股 沪深300 沪深主板 公司总部 总部所在地 股东大会 会议地点 上市企业 上市办公地 上市企业总部 板块 消费 科技 金融'
  c.listedtext = [
    universal,
    ...entry.map(x => [x.n, x.c, x.ex, x.s, x.i].filter(Boolean).join(' ')),
  ].join(' ')
  // 板块集合（去重）
  c.listedsectors = [...new Set(entry.map(x => x.s).filter(Boolean))]
  for (const s of c.listedsectors) sectorSet.add(s)
  ownEntry ? own++ : inherited++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`上市公司注入：自有 ${own} 城，继承母城 ${inherited} 城，共 ${totalCompanies} 家公司`)
console.log(`覆盖 ${own + inherited}/${dataset.cities.length} 城市；板块集合：${[...sectorSet].join('、')}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
