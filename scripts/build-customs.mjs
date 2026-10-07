// 当地特殊习俗注入：读 scripts/customs.json，写回 src/data/cities_full.json
//   - 母城直接命中：c.customs / c.customstext
//   - 县/区/县级市：继承母城习俗
//   - customstext = 习俗标题 + 描述 + 通用词，供 matchQuery 搜索
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const rSrc = JSON.parse(fs.readFileSync('scripts/customs.json', 'utf8')).cities

const byName = new Map(dataset.cities.map(c => [c.name, c]))
const missing = Object.keys(rSrc).filter(k => !byName.has(k))
if (missing.length) {
  console.log('⚠ customs.json 未命中数据集：', missing.join('、'))
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

for (const c of dataset.cities) { delete c.customs; delete c.customstext }

let own = 0, inherited = 0
for (const c of dataset.cities) {
  const ownEntry = rSrc[c.name]
  const root = resolveRoot(c.parent)
  const rootEntry = root && rSrc[root.name]
  const entry = ownEntry || rootEntry
  if (!entry || !Array.isArray(entry) || !entry.length) continue
  c.customs = entry
  // 搜索文本：标题 + 描述 + 通用词（让搜「辣/清真/方言/狗肉/昆虫/酒文化/高原反应」都能命中）
  c.customstext = [
    '当地习俗', '特殊习俗', '注意事项', '风土人情',
    ...entry.map(x => [x.t, x.d].filter(Boolean).join(' ')),
  ].join(' ')
  ownEntry ? own++ : inherited++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`习俗注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${dataset.cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
