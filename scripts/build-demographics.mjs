// 人口结构数据注入：七普（2020）地市级数据 → src/data/cities_full.json
//   - 输入: scripts/demographics-raw/census2020-prefecture.csv（汇编数据集，见该目录 README）
//   - 地级市（无 parent）直接匹配；区县继承母城（与 build-fiscal.mjs 同模式）
//   - 运行: node scripts/build-demographics.mjs
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const RAW_CSV = 'scripts/demographics-raw/census2020-prefecture.csv'
const SRC = 'scripts/demographics.json'
const CENSUS_YEAR = 2020

if (!fs.existsSync(RAW_CSV)) {
  console.error(`缺少 ${RAW_CSV}，请先准备七普汇编数据集`)
  process.exit(1)
}

// ---------- 1. 解析 CSV ----------
// 列: province,city,pop2020_wan,sex_ratio,age0_14,age15_59,age60plus,age65plus,pop2010_wan,source_url
const lines = fs.readFileSync(RAW_CSV, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
const header = lines[0].split(',').map(s => s.trim())
const col = name => header.indexOf(name)
const rows = []
for (const line of lines.slice(1)) {
  const f = line.split(',')
  const num = i => {
    const v = parseFloat(f[i])
    return Number.isFinite(v) ? v : null
  }
  rows.push({
    province: f[col('province')]?.trim(),
    city: f[col('city')]?.trim(),
    pop: num(col('pop2020_wan')),
    sex_ratio: num(col('sex_ratio')),
    age0_14: num(col('age0_14')),
    age15_59: num(col('age15_59')),
    age60plus: num(col('age60plus')),
    age65plus: num(col('age65plus')),
    pop2010: num(col('pop2010_wan')),
  })
}
console.log(`读取七普数据：${rows.length} 行`)

// ---------- 2. 名称 → 数据映射（匹配在注入时按名称完成） ----------
// 应用数据集存在特殊形态：部分地级单位不作为根城市存在（延吉 parent=延边朝鲜族自治州，
// 济源 parent=省直辖县级市 伪根，呼伦贝尔 parent=海拉尔区 倒挂），
// 因此注入不依赖根城市 id 匹配，而是直接按 规范化名称 → 七普数据 查表。
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const cities = dataset.cities
const roots = cities.filter(c => !c.parent)

const norm = s => (s || '').replace(/(省|市|地区|盟|自治州|壮族自治区|回族自治区|维吾尔自治区|特别行政区|土家族苗族自治州|藏族羌族自治州|彝族自治州|白族自治州|傣族自治州|傈僳族自治州|藏族自治州|哈尼族彝族自治州|壮族苗族自治州|蒙古自治州|朝鲜族自治州|回族自治州|柯尔克孜自治州|哈萨克自治州|林区)$/, '').trim()

const demogSrc = {
  _comment: '人口结构（第七次全国人口普查 2020 地市级数据），区县继承母城',
  source: '第七次全国人口普查公报 / 中国人口普查年鉴2020（汇编见 demographics-raw/README.md）',
  census_year: CENSUS_YEAR,
  cities: {},
}

// demogByName: 规范化城市名 → 数据（含 pop_change 计算）
const demogByName = {}
let rowN = 0
for (const r of rows) {
  if (!r.city || r.pop == null) continue
  const d = {
    pop: r.pop,
    sex_ratio: r.sex_ratio,
    age0_14: r.age0_14,
    age15_59: r.age15_59,
    age60plus: r.age60plus,
    age65plus: r.age65plus,
  }
  if (r.pop2010 != null && r.pop2010 > 0) {
    d.pop2010 = r.pop2010
    d.pop_change = Math.round(((r.pop - r.pop2010) / r.pop2010) * 1000) / 10 // 10年增减%
  }
  demogByName[norm(r.city)] = d
  demogSrc.cities[norm(r.city)] = d
  rowN++
}
console.log(`七普数据加载：${rowN} 个地级单位`)

// ---------- 3. 自动解读标签 ----------
function profile(d) {
  const tags = []
  if (d.pop_change != null) {
    if (d.pop_change >= 10) tags.push('人口大幅流入')
    else if (d.pop_change >= 3) tags.push('人口流入')
    else if (d.pop_change <= -10) tags.push('人口明显流出')
    else if (d.pop_change <= -3) tags.push('人口流出')
  }
  if (d.age65plus != null) {
    if (d.age65plus >= 16) tags.push('深度老龄化')
    else if (d.age65plus >= 12) tags.push('老龄化偏高')
    else if (d.age65plus <= 8) tags.push('人口年轻')
  }
  if (d.sex_ratio != null) {
    if (d.sex_ratio >= 110) tags.push('男多女少')
    else if (d.sex_ratio <= 100) tags.push('女多男少')
  }
  return tags
}

// ---------- 4. 注入 cities_full.json（按名称查表：自身 → 母城名 → 根城市）----------
function lookup(c) {
  // 1) 城市自身名直接命中（覆盖 呼伦贝尔倒挂 / 济源等省直辖县级市伪根形态）
  const own = demogByName[norm(c.name)]
  if (own) return { d: own, inherited: false }
  if (!c.parent) return null
  // 2) 母城名命中（延吉→延边朝鲜族自治州、吉首→湘西州、漠河→大兴安岭地区，母城不必存在于数据集）
  const headRaw = c.parent.split(/[·/]/)[0].trim()
  const head = norm(headRaw)
  const byParent = demogByName[head]
  if (byParent) return { d: byParent, inherited: true }
  // 3) 常规区县：找根城市再查表
  const root = roots.find(c2 => c2.name === headRaw)
    || roots.find(c2 => norm(c2.name) === head || headRaw.startsWith(c2.name) || c2.name.startsWith(head))
  if (root && demogByName[norm(root.name)]) return { d: demogByName[norm(root.name)], inherited: true }
  return null
}

for (const c of cities) { delete c.demog; delete c.demogtext }

let own = 0, inherited = 0
for (const c of cities) {
  const hit = lookup(c)
  if (!hit) continue
  const { d } = hit

  c.demog = { ...d, census_year: CENSUS_YEAR, inherited: hit.inherited || undefined }
  const tags = profile(d)
  if (tags.length) c.demog.tags = tags
  // 口语化搜索词：标准档位关键词 + 描述性口语
  // 命中规则：某城 65+=21.87% → haystack 含「超过20%」「超过15%」「超过10%」「超过5%」，
  // 用户搜「老龄人口超过20%」时所有 65+>=20 的城市都命中
  const sexWords = []
  if (d.sex_ratio != null) {
    const sr = d.sex_ratio
    if (sr >= 115) sexWords.push('男多女少 男生多 女生少 男人多 性别比高 男性多 男生比例高')
    else if (sr >= 108) sexWords.push('男略多 男多女少 男生略多 男生比例高')
    else if (sr <= 95) sexWords.push('女多男少 女生多 男生少 女人多 性别比低 女性多 女生比例高')
    else if (sr <= 100) sexWords.push('女略多 女多男少 女生略多 女生比例高')
    // 性别比档位（≥100/105/110/115）
    for (const th of [100, 105, 110, 115]) if (sr >= th) sexWords.push(`性别比超过${th}`)
    for (const th of [100, 95, 90]) if (sr <= th) sexWords.push(`性别比低于${th}`)
  }
  const ageWords = []
  if (d.age65plus != null) {
    const v = d.age65plus
    // 生成所有低于自身值的标准档位（每 5%），用户搜「超过X%」时批量命中
    for (const th of [5, 10, 12, 15, 20, 25]) {
      if (v >= th) ageWords.push(`老龄人口超过${th}% 老年人口超过${th}% 老人占比超过${th}% 65岁以上超过${th}%`)
    }
    if (v >= 14) ageWords.push('深度老龄化 老龄化严重 老人多 老年人多 养老城市 慢节奏')
    else if (v >= 7) ageWords.push('老龄化 老人偏多')
    else ageWords.push('人口年轻 年轻人多 活力城市')
  }
  if (d.age60plus != null) {
    const v = d.age60plus
    for (const th of [10, 15, 20, 25, 30]) {
      if (v >= th) ageWords.push(`60岁以上超过${th}% 老年人口${th}%`)
    }
  }
  c.demogtext = [
    '人口', '常住人口', '性别比', '男女比例', '老龄化', '年龄结构', '人口结构',
    tags.join(' '),
    ...sexWords, ...ageWords,
    d.pop_change != null && d.pop_change > 0 ? '人口流入 年轻人多 人口增长 人口增加 净流入' : '',
    d.pop_change != null && d.pop_change < 0 ? '人口流出 人口收缩 人口减少 人口下降 净流出' : '',
    d.age65plus != null && d.age65plus >= 12 ? '养老城市 老人多 慢节奏' : '',
    d.age65plus != null && d.age65plus <= 8 ? '年轻城市 活力' : '',
  ].filter(Boolean).join(' ')
  hit.inherited ? inherited++ : own++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`人口结构注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
