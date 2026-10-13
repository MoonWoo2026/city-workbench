// 当地应季水果注入：scripts/fruits.json（人工精编）→ src/data/cities_full.json
//   - 地级市直接匹配；区县优先自身短名（如 仙居），否则继承母城（与 build-demographics.mjs 同模式）
//   - 注入 c.fruits（[{n, m:[月份], d}]）+ c.fruittext（搜索文本：水果名 + X自由 + N月水果 + 通用词）
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
const roots = cities.filter(c => !c.parent)

const norm = s => (s || '').replace(/(省|市|地区|盟|自治州|壮族自治区|回族自治区|维吾尔自治区|特别行政区|土家族苗族自治州|藏族羌族自治州|彝族自治州|白族自治州|傣族自治州|傈僳族自治州|藏族自治州|哈尼族彝族自治州|壮族苗族自治州|蒙古自治州|朝鲜族自治州|回族自治州|柯尔克孜自治州|哈萨克自治州|林区)$/, '').trim()

console.log(`精编水果数据：${Object.keys(fruitByName).length} 个产地`)

// ---------- 三级 lookup：自身短名 → 母城名 → 根城市 ----------
function lookup(c) {
  const own = fruitByName[norm(c.name)]
  if (own) return { list: own, inherited: false }
  if (!c.parent) return null
  const headRaw = c.parent.split(/[·/]/)[0].trim()
  const head = norm(headRaw)
  const byParent = fruitByName[head]
  if (byParent) return { list: byParent, inherited: true }
  const root = roots.find(c2 => c2.name === headRaw)
    || roots.find(c2 => norm(c2.name) === head || headRaw.startsWith(c2.name) || c2.name.startsWith(head))
  if (root && fruitByName[norm(root.name)]) return { list: fruitByName[norm(root.name)], inherited: true }
  return null
}

for (const c of cities) { delete c.fruits; delete c.fruittext }

let own = 0, inherited = 0
for (const c of cities) {
  const hit = lookup(c)
  if (!hit) continue
  const { list } = hit

  c.fruits = list.map(f => ({ n: f.n, m: f.m, d: f.d }))
  if (hit.inherited) c.fruitsInherited = true

  // 搜索文本：水果名 + 描述 + 「X自由」+ 覆盖月份的「N月水果/应季」+ 通用词
  const words = ['应季水果', '时令水果', '水果自由', '特产水果', '水果产地', '本地水果', '当季水果']
  const months = new Set()
  for (const f of list) {
    words.push(f.n, f.d || '', `${f.n}自由`, `${f.n}产地`)
    for (const m of f.m) months.add(m)
  }
  for (const m of [...months].sort((a, b) => a - b)) {
    words.push(`${m}月水果`, `${m}月应季`, `${m}月时令`)
  }
  // 全年有果的标志
  if (months.size >= 10) words.push('全年有水果', '四季水果', '水果多')
  c.fruittext = words.filter(Boolean).join(' ')
  hit.inherited ? inherited++ : own++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`应季水果注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
