// 三甲医院数据注入：解析 scripts/hospitals-3a.csv（来源：github 46319943/3AHospital，百度医生公开数据）
// 按地址文本匹配到城市（同省内最长名优先），结果写回 src/data/cities_full.json：
//   - 顶层 hospitals: { 匹配key: [医院名...] }
//   - 每个城市 med: { n: 本市三甲数, p: 母城三甲数, k: 名单查询key }
// 县/镇无三甲时继承母城（k 指向母城 key，卡片显示「市区三甲 N 家」）。
import fs from 'node:fs'

const DATA = 'src/data/cities_full.json'
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))

// ---- 1. 解析 CSV ----
const raw = fs.readFileSync('scripts/hospitals-3a.csv', 'utf8').trim().split('\n').slice(1)
const rows = raw.map(line => {
  // 地址里含逗号，从尾部取经纬度两列，其余为 name+address
  const m = line.match(/^(.*),(-?\d+\.\d+),(-?\d+\.\d+)$/)
  if (!m) return null
  const head = m[1]
  const i = head.indexOf(',')
  return { name: head.slice(0, i), address: head.slice(i + 1), lng: +m[2], lat: +m[3] }
}).filter(Boolean)
console.log('医院总数:', rows.length)

// ---- 2. 建省内匹配表 ----
const PROVINCES = ['北京', '天津', '上海', '重庆', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南',
  '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆']
// 省内候选：城市名 + 母城key（自治州/地区名），按长度降序
const byProv = {}
for (const c of dataset.cities) {
  const prov = c.province
  const keys = byProv[prov] ||= new Set()
  keys.add(c.name)
  if (c.parent) keys.add(c.parent)
}
const provMatchers = {}
for (const [prov, set] of Object.entries(byProv)) {
  provMatchers[prov] = [...set].sort((a, b) => b.length - a.length)
}

// 坐标兜底：地址无省名时（如"东城区..."实为北京），就近匹配城市
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371, rad = Math.PI / 180
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function nearestKey(lng, lat) {
  let best = null, bestD = Infinity
  for (const c of dataset.cities) {
    if (c.lng == null) continue
    const d = haversine(lng, lat, c.lng, c.lat)
    if (d < bestD) { bestD = d; best = c }
  }
  if (!best || bestD > 60) return null
  return best.parent || best.name
}

// ---- 3. 匹配 ----
const hospitals = {} // key -> [names]
let matched = 0, geoMatched = 0
const unmatched = []
for (const r of rows) {
  const prov = PROVINCES.find(p => r.address.includes(p))
  let key = prov ? provMatchers[prov].find(k => r.address.includes(k)) : null
  if (!key && r.lng && r.lat) {
    key = nearestKey(r.lng, r.lat)
    if (key) geoMatched++
  }
  if (!key) { unmatched.push(r); continue }
  ;(hospitals[key] ||= []).push(r.name)
  matched++
}
console.log('匹配成功:', matched, '(其中坐标兜底', geoMatched + ')', '未匹配:', unmatched.length)
if (unmatched.length) {
  console.log('未匹配样例:')
  unmatched.slice(0, 10).forEach(r => console.log(' -', r.name, '|', r.address.slice(0, 30)))
}

// ---- 3.5 手工补丁：CSV（百度医生数据集）未收录的知名三甲，均为各省卫健委公开评审结果 ----
const PATCH = {
  鹤岗: ['鹤岗市人民医院'],
  佳木斯: ['佳木斯大学附属第一医院', '佳木斯市中心医院'],
  大理白族自治州: ['大理白族自治州人民医院', '大理大学第一附属医院'],
  德宏傣族景颇族自治州: ['德宏傣族景颇族自治州人民医院'],
  西双版纳傣族自治州: ['西双版纳傣族自治州人民医院'],
  丽江: ['丽江市人民医院'],
  楚雄彝族自治州: ['楚雄彝族自治州人民医院'],
  普洱: ['普洱市人民医院'],
  临沧: ['临沧市人民医院'],
  文山壮族苗族自治州: ['文山壮族苗族自治州人民医院'],
}
for (const [k, names] of Object.entries(PATCH)) {
  hospitals[k] = [...new Set([...(hospitals[k] || []), ...names])]
}

// ---- 4. 注入城市 ----
let withOwn = 0, withPref = 0
for (const c of dataset.cities) {
  const own = hospitals[c.name]?.length || 0
  const pCount = c.parent ? (hospitals[c.parent]?.length || 0) : 0
  if (own > 0) {
    c.med = { n: own, p: pCount, k: c.name }
    withOwn++
  } else if (pCount > 0) {
    c.med = { n: 0, p: pCount, k: c.parent }
    withPref++
  } else {
    delete c.med
  }
}
dataset.hospitals = hospitals
fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`注入完成：本市有三甲 ${withOwn} 城，仅母城有 ${withPref} 城，名单 key 数 ${Object.keys(hospitals).length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')
