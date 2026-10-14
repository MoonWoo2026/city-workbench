// 当地应季水果注入：scripts/fruits.json（人工精编）→ src/data/cities_full.json
//   - 条目 c 字段标注产地县；构建时按 c 自动生成「产地县建卡」：
//     本县主产（排最前）+ 母城全市共产（无 c 标注的条目）
//   - 其余区县继承母城列表：本县产 → 全市产 → 其他县产（前端标「产自X」）
//   - 母城校验：产地县仅在 parent 与来源 key 一致时建卡，防跨省撞名（兰州安宁 vs 云南安宁）
//   - 名称匹配兼容数据集形态：民族字样（柯尔克孜/蒙古/…）、州县连写（红河州元阳县）、
//     自治州简称（凉山州）、伪根（省直辖县级市）、地区/盟
//   - 运行: node scripts/build-fruits.mjs
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const SRC = 'scripts/fruits.json'

if (!fs.existsSync(SRC)) {
  console.error(`缺少 ${SRC}`)
  process.exit(1)
}

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const fruitByName = src.cities
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const cities = dataset.cities

// 短名：去民族字样 + 末尾剥一层行政后缀（保留州字——台州/柳州等城市名含州）
const ETHNIC = /(维吾尔|柯尔克孜|哈萨克|塔吉克|景颇|蒙古|朝鲜|土家|哈尼|傈僳|布依|回|彝|藏|羌|白|傣|苗|侗|壮|黎|族)/g
const ADM = /(特别行政区|自治州|自治县|自治旗|地区|林区|盟|省|市|县|区|旗)$/
const base = s => (s || '').replace(ETHNIC, '').replace(ADM, '').trim()
// 州字双候选：凉山州→[凉山州,凉山]（匹配简称 parent），杭州→[杭州,杭]（杭非 key，无害）
const cands = s => {
  const t = base(s)
  return t.length > 2 && t.endsWith('州') ? [t, t.slice(0, -1)] : [t]
}
const hit = (map, s) => cands(s).map(k => map[k]).find(Boolean)

// 解析 parent：分离「州/地区/盟前缀」与「下辖县名」（红河州元阳县 → 红河州 + 元阳县）
function parseParent(c) {
  const headRaw = (c.parent || '').split(/[·/]/)[0].trim()
  const m = headRaw.match(/^(.+?(?:自治州|地区|盟|州))((?:自治县|自治旗|县|市|区).*)?$/)
  if (m && m[2]) return { pref: m[1], rest: m[2] }
  return { pref: headRaw, rest: '' }
}

// 产地县索引：县短名 → { city: 来源 key, items: 本县产, wide: 全市产 }
const countyIndex = {}
for (const [cityKey, list] of Object.entries(fruitByName)) {
  const sk = base(cityKey)
  for (const f of list) {
    if (f.c) (countyIndex[base(f.c)] ||= { city: cityKey, items: [], wide: [] }).items.push(f)
    else (countyIndex[sk] ||= { city: cityKey, items: [], wide: [] }).wide.push(f)
  }
}

// 可命中的短名集合（城市名 + parent 前缀的全部候选），用于告警
const allShorts = new Set()
for (const c of cities) {
  for (const k of cands(c.name)) allShorts.add(k)
  if (c.parent) for (const k of cands(parseParent(c).pref)) allShorts.add(k)
}
for (const k of Object.keys(fruitByName)) {
  if (!cands(k).some(x => allShorts.has(x))) console.warn(`⚠️  fruits.json key「${k}」不匹配任何地级单位，将被忽略`)
}

// ---------- 注入逻辑 ----------
function lookup(c) {
  const keys = cands(c.name)
  // 1) 根城市 / 伪根（省直辖县级市）：自有 key
  if (!c.parent || /省直辖|自治区直辖/.test(c.parent)) {
    const own = keys.map(k => fruitByName[k]).find(Boolean)
    return own ? { list: own, kind: 'root' } : null
  }
  const pref = parseParent(c).pref
  const mk = cands(pref).map(k => fruitByName[k]).find(Boolean) // 母城列表
  const mkName = cands(pref).find(k => fruitByName[k]) // 命中的母城短名
  // 2) 产地县建卡：c 标注命中且母城与来源 key 一致（防跨省撞名）
  const idx = countyIndex[keys[0]]
  if (idx && idx.items.length && mkName && cands(idx.city).includes(mkName)) {
    return { list: [...idx.items, ...idx.wide], kind: 'county' }
  }
  // 3) 继承母城：本县产 → 全市产 → 其他县产（前端标「产自X」）
  if (!mk) return null
  const mine = mk.filter(f => f.c && cands(f.c).some(x => keys.includes(x)))
  const wide = mk.filter(f => !f.c)
  const others = mk.filter(f => f.c && !cands(f.c).some(x => keys.includes(x)))
  return { list: [...mine, ...wide, ...others], kind: 'inherited' }
}

for (const c of cities) { delete c.fruits; delete c.fruittext; delete c.fruitsInherited }

let rootN = 0, countyN = 0, inheritedN = 0
for (const c of cities) {
  const hitRes = lookup(c)
  if (!hitRes) continue
  const { list, kind } = hitRes

  c.fruits = list.map(f => ({ n: f.n, m: f.m, d: f.d, c: f.c, origin: f.c && base(f.c) !== base(c.name) ? f.c : undefined }))
  if (kind === 'inherited') c.fruitsInherited = true

  // 搜索文本：水果名 + 描述 + 产地县组合词 + 「X自由」+ 覆盖月份的「N月水果」+ 通用词
  const words = ['应季水果', '时令水果', '水果自由', '特产水果', '水果产地', '本地水果', '当季水果']
  const months = new Set()
  for (const f of list) {
    words.push(f.n, f.d || '', `${f.n}自由`, `${f.n}产地`)
    if (f.c) words.push(`${f.c}特产`, `${f.c}${f.n}`)
    for (const m of f.m) months.add(m)
  }
  for (const m of [...months].sort((a, b) => a - b)) {
    words.push(`${m}月水果`, `${m}月应季`, `${m}月时令`)
  }
  if (months.size >= 10) words.push('全年有水果', '四季水果', '水果多')
  c.fruittext = words.filter(Boolean).join(' ')
  if (kind === 'root') rootN++
  else if (kind === 'county') countyN++
  else inheritedN++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`应季水果注入：地级市/省直辖 ${rootN}，产地县建卡 ${countyN}，继承母城 ${inheritedN}，覆盖 ${rootN + countyN + inheritedN}/${cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
