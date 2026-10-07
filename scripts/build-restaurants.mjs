// 本地苍蝇馆子/市井名店注入：读 scripts/restaurants.json，写回 src/data/cities_full.json
//   - 母城直接命中：c.restaurants / c.restauranttext
//   - 县/区/县级市：继承母城餐馆
//   - restauranttext = 店名 + 招牌菜，供 matchQuery 搜索
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const rSrc = JSON.parse(fs.readFileSync('scripts/restaurants.json', 'utf8')).cities

const byName = new Map(dataset.cities.map(c => [c.name, c]))
const missing = Object.keys(rSrc).filter(k => !byName.has(k))
if (missing.length) {
  console.log('⚠ restaurants.json 未命中数据集：', missing.join('、'))
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

for (const c of dataset.cities) { delete c.restaurants; delete c.restauranttext }

let own = 0, inherited = 0
for (const c of dataset.cities) {
  const ownEntry = rSrc[c.name]
  const root = resolveRoot(c.parent)
  const rootEntry = root && rSrc[root.name]
  const entry = ownEntry || rootEntry
  if (!entry) continue
  c.restaurants = entry.r
  // 店名+招牌菜+通用词，供搜索「苍蝇馆子/市井名店」等匹配
  c.restauranttext = ['苍蝇馆子', '市井名店', '本地馆子', ...entry.r.map(x => [x.name, x.dish].filter(Boolean).join(' '))].join(' ')
  ownEntry ? own++ : inherited++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`苍蝇馆子注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${dataset.cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
