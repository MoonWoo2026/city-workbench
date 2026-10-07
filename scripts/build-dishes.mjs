// 城市名菜注入：读 scripts/dishes.json，写回 src/data/cities_full.json
//   - 母城直接命中：c.dishes / c.foodtext
//   - 县/区/县级市：继承母城名菜（按 parent 首段解析母城名），自身在 dishes.json 里单列的（沙县/简阳等）用自身的
//   - foodtext = 菜名 + 类别词（火锅/面食/米粉…，供 matchQuery 搜索；县区继承后同样可搜「火锅」）
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const dishesSrc = JSON.parse(fs.readFileSync('scripts/dishes.json', 'utf8')).cities

// 类别 → 搜索附加词（菜名本身已含变体，如「潮汕牛肉火锅」「铜锅涮肉」）
const GROUP_TOKENS = {
  火锅: ['火锅'],
  面食: ['面食', '面条'],
  米粉: ['米粉', '米线', '粉丝'],
  烧烤: ['烧烤', '烤肉'],
  海鲜: ['海鲜'],
  早茶: ['早茶', '茶点', '点心'],
  饺子: ['饺子', '水饺'],
  辣味: ['辣', '辣味'],
  甜品: ['甜品', '糖水', '甜食'],
  羊肉: ['羊肉'],
  牛肉: ['牛肉'],
  豆腐: ['豆腐'],
  家常: ['炒菜', '家常菜', '家常', '做饭', '下厨', '小炒'],
  清淡: ['清淡', '不辣', '鲜甜', '粤菜', '江浙菜', '养生'],
  重口: ['重口', '重口味', '下饭', '咸鲜', '咸辣', '湘菜', '赣菜'],
}

const byName = new Map(dataset.cities.map(c => [c.name, c]))

// 校验 dishes.json 的 key 是否都在数据集里
const missing = []
for (const key of Object.keys(dishesSrc)) {
  if (!byName.has(key)) missing.push(key)
}
if (missing.length) {
  console.log('⚠ dishes.json 中以下名字未命中数据集，请核对后重跑：')
  console.log('  ' + missing.join('、'))
}

// 母城解析：parent 形如「北京市」「九江市·庐山市」「保定/雄县·容城·安新」「大理白族自治州」
// 取首段，再在「无 parent 的母城」里模糊匹配
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

// 清理旧注入（幂等）
for (const c of dataset.cities) { delete c.dishes; delete c.foodtext }

let own = 0, inherited = 0
for (const c of dataset.cities) {
  const ownEntry = dishesSrc[c.name]
  const root = resolveRoot(c.parent)
  const rootEntry = root && dishesSrc[root.name]
  const entry = ownEntry || rootEntry
  if (!entry) continue
  c.dishes = entry.d
  const toks = [...entry.d]
  for (const g of entry.g || []) toks.push(...(GROUP_TOKENS[g] || [g]))
  c.foodtext = [...new Set(toks)].join(' ')
  ownEntry ? own++ : inherited++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`名菜注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${dataset.cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
