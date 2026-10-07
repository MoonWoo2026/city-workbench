// 安全/边境数据注入：
//   - border: 是否陆地边境县/市（公安部公边[1999]4号名单），客观行政属性
//   - safety: 群众安全感等官方指标（有则显示，无则 null，县区继承母城/本省）
//   - safetytext: 搜索关键词（边境/边疆/治安/安全…）
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const borderSrc = JSON.parse(fs.readFileSync('scripts/border-cities.json', 'utf8')).cities
const safetySrc = JSON.parse(fs.readFileSync('scripts/safety-data.json', 'utf8'))

const strip = s => (s || '').replace(/(市|县|旗|区|自治县|自治旗|满族自治县|朝鲜族自治县|蒙古族自治县|哈萨克自治县|塔吉克自治县|佤族自治县|拉祜族佤族自治县|傣族佤族自治县|苗族瑶族傣族自治县|瑶族自治县|独龙族怒族自治县)$/, '')

// 边境城市名集合（剥后缀后做模糊匹配）
const borderStripped = new Set(borderSrc.map(strip))
const isBorder = name => borderStripped.has(strip(name))

// 母城解析（同 build-dishes.mjs）
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
for (const c of dataset.cities) { delete c.border; delete c.safety; delete c.safetytext }

let borderCount = 0, safetyCount = 0
for (const c of dataset.cities) {
  // 边境：自身或母城为边境县
  const root = resolveRoot(c.parent)
  const border = isBorder(c.name) || (root && isBorder(root.name))
  if (border) { c.border = true; borderCount++ }

  // 安全指标：自身 → 母城 → 本省
  let safety = safetySrc.cities[c.name]
  if (!safety && root) safety = safetySrc.cities[root.name]
  if (!safety) safety = safetySrc.provinces[c.province]
  if (safety) { c.safety = safety; safetyCount++ }

  // 搜索文本
  const toks = []
  if (c.border) toks.push('边境', '边疆', '边境城市', '边境小城')
  if (c.safety?.security) toks.push('治安好', '安全', '群众安全感高')
  c.safetytext = toks.join(' ')
}

console.log(`✓ 边境城市: ${borderCount} / ${dataset.cities.length}`)
console.log(`✓ 有安全数据: ${safetyCount} / ${dataset.cities.length}`)

fs.writeFileSync(DATA, JSON.stringify(dataset, null, 0))
console.log('已写入', DATA)
