/**
 * 坐标抓取脚本：为 cities_full.json 的每个条目解析经纬度（GCJ-02，与高德瓦片对齐）
 *
 * 数据源：阿里云 DataV GeoAtlas  https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json
 *
 * 匹配策略（按优先级）：
 *  0. MANUAL 手工坐标表（镇/村/景区级，DataV 无对应行政区）
 *  1. 直辖市本体直接用省级中心
 *  2. 无 parent：省级 features 匹配地级市/省直辖县级市
 *  3. parent 以「省直辖」开头或含「兵团」：直接在省级 features 匹配条目名
 *  4. parent 即省名（直辖市区县）：在省级 features 匹配条目名
 *  5. 组合 parent（如「雅安市荥经县」）：拆出地级部分 → 市级 features 匹配条目名/县级部分
 *  6. 常规 parent：解析地级市 → 市级 features 匹配区县（含前缀模糊）
 *  7. 条目名在省级 features 的最后尝试（如 呼伦贝尔 parent=海拉尔区）
 *  8. parent 为县级：全省地级市 lazy 扫描找到该县，用县中心近似
 *
 * 输出：scripts/coords.json   { id: [lng, lat] }
 * 缓存：scripts/.geo-cache/{adcode}.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dir, '.geo-cache')
const DATA_PATH = join(__dir, '..', 'src', 'data', 'cities_full.json')
const OUT_PATH = join(__dir, 'coords.json')

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })

// ---- 手工坐标表（镇/村/景区级，GCJ-02） ----
const MANUAL = {
  '河北_xiongan': [115.93, 38.92],       // 雄安新区
  '河北_yanjiao': [116.81, 39.95],       // 燕郊镇
  '吉林_jingyue': [125.45, 43.79],       // 长春净月
  '吉林_erdaobaihe': [128.12, 42.45],    // 长白山二道白河
  '浙江_qiandaohu': [119.04, 29.60],     // 千岛湖镇
  '浙江_moganshan': [119.86, 30.61],     // 莫干山
  '浙江_wuzhen': [120.49, 30.75],        // 乌镇
  '安徽_jiuhuashan': [117.81, 30.48],    // 九华山九华街
  '安徽_hongcun': [117.99, 29.90],       // 宏村
  '安徽_zhaji': [118.35, 30.55],         // 查济古村
  '福建_yunshuiyao': [117.06, 24.66],    // 云水谣
  '江西_lushan': [115.99, 29.56],        // 庐山牯岭镇
  '江西_yaoli': [117.46, 29.55],         // 瑶里古镇
  '湖南_furongzhen': [109.94, 28.70],    // 芙蓉镇
  '广东_dapeng': [114.47, 22.60],        // 大鹏新区
  '广西_huangyao': [110.82, 24.30],      // 黄姚古镇
  '广西_weizhoudao': [109.11, 21.04],    // 涠洲岛
  '四川_longcanggou': [102.87, 29.67],   // 荥经龙苍沟
  '四川_qingchengshan': [103.57, 30.90], // 青城山
  '四川_wawushan': [102.95, 29.71],      // 瓦屋山
  '四川_jiezi': [103.63, 30.82],         // 街子古镇
  '四川_huanglongxi': [103.97, 30.32],   // 黄龙溪
  '贵州_xijiang': [108.17, 26.49],       // 西江千户苗寨
  '贵州_fanjingshan': [108.77, 27.90],   // 梵净山
  '贵州_tianyan': [106.85, 25.65],       // 平塘天眼（克度镇）
  '贵州_huangguoshu': [105.67, 25.98],   // 黄果树
  '云南_fuxianhu': [102.90, 24.67],      // 抚仙湖
  '云南_shaxi': [99.90, 26.32],          // 沙溪古镇
  '云南_shuanglang': [100.20, 25.91],    // 双廊
  '云南_daligucheng': [100.16, 25.69],   // 大理古城
  '云南_shuhe': [100.20, 26.92],         // 束河古镇
  '云南_baisha': [100.20, 26.96],        // 丽江白沙古镇
  '云南_heshun': [98.45, 25.01],         // 腾冲和顺古镇
  '云南_luguhu': [100.79, 27.70],        // 泸沽湖
  '云南_yuanyang': [102.76, 23.14],      // 元阳梯田
  '云南_puzhehei': [104.11, 24.13],      // 普者黑
  '云南_bamei': [105.00, 24.32],         // 坝美村
  '云南_dongchuan': [103.00, 26.05],     // 东川红土地
  '云南_xizhou': [100.10, 25.86],        // 喜洲
  '西藏_shiquanhe': [80.10, 32.50],      // 狮泉河镇
  '西藏_lulang': [94.68, 29.76],         // 鲁朗小镇
  '陕西_huashan': [110.09, 34.49],       // 华山
  '陕西_yuanjiacun': [108.57, 34.56],    // 袁家村
  '甘肃_liujiaxia': [103.32, 35.94],     // 刘家峡
  '甘肃_yeliguan': [103.59, 34.62],      // 冶力关
  '甘肃_guanegou': [104.43, 33.97],      // 官鹅沟
  '青海_chaka': [99.08, 36.70],          // 茶卡盐湖
  '青海_qinghaihu': [100.49, 36.62],     // 青海湖（二郎剑）
  '新疆_kanasi': [87.01, 48.70],         // 喀纳斯
  '新疆_nalati': [84.05, 43.30],         // 那拉提
  '新疆_hemu': [87.43, 48.57],           // 禾木
  '新疆_baihaba': [87.55, 48.69],        // 白哈巴
  '新疆_keketuohai': [89.81, 47.22],     // 可可托海
  '新疆_huyanghe': [84.83, 44.70],       // 胡杨河市（兵团第七师）
  '新疆_xinxing': [93.71, 42.83],        // 新星市（兵团第十三师）
  '新疆_baiyang': [82.95, 46.68],        // 白杨市（兵团第九师）
}

// ---- 工具 ----
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchGeo(adcode) {
  const cacheFile = join(CACHE_DIR, `${adcode}.json`)
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      writeFileSync(cacheFile, JSON.stringify(json))
      await sleep(120)
      return json
    } catch (e) {
      if (attempt === 2) throw new Error(`fetch ${adcode} 失败: ${e.message}`)
      await sleep(800 * (attempt + 1))
    }
  }
}

// 名称归一化：先剥民族自治后缀，再剥常规行政后缀
const SUFFIXES = [
  '特别行政区', '壮族自治区', '回族自治区', '维吾尔自治区', '自治区',
  '自治州', '自治县', '自治旗', '地区', '盟', '林区', '新区',
  '省', '市', '区', '县', '旗',
]
const ETHNIC = '哈萨克|维吾尔|柯尔克孜|塔吉克|蒙古|土家|布依|朝鲜|傈僳|仡佬|仫佬|毛南|景颇|德昂|阿昌|普米|独龙|拉祜|纳西|布朗|撒拉|东乡|裕固|哈尼|藏|彝|苗|壮|侗|瑶|白|傣|黎|佤|羌|土|满|回|畲|水|怒'
const RE_AUTONOMOUS = new RegExp(`((?:${ETHNIC})族)+自治(县|州|旗)$`)
const RE_AUTONOMOUS_BARE = /自治(县|州|旗)$/
const RE_ETHNIC_TAIL = /(?:哈萨克|维吾尔|柯尔克孜|塔吉克)族?$/
function norm(name) {
  let s = String(name || '').trim()
  // 民族自治州/县：剥「XX族…自治州/县/旗」尾部（族名显式枚举，避免吃掉地名主体）
  let stripped = false
  s = s.replace(RE_AUTONOMOUS, () => { stripped = true; return '' })
  // 兜底：无「族」字的自治州/县（如 伊犁哈萨克自治州 → 伊犁哈萨克 → 伊犁）
  if (!stripped) s = s.replace(RE_AUTONOMOUS_BARE, () => { stripped = true; return '' })
  // 尾部落单族名仅在剥过自治后缀时才处理（避免误伤 丽水/衡水/赤水 等）
  if (stripped) s = s.replace(RE_ETHNIC_TAIL, '')
  for (const suf of SUFFIXES) {
    if (s.length > suf.length + 1 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break }
  }
  return s
}

// 从 feature 取坐标：优先 center/centroid，否则用几何 bbox 中心
function featureCoord(f) {
  const p = f.properties || {}
  if (Array.isArray(p.center) && p.center.length >= 2) return [p.center[0], p.center[1]]
  if (Array.isArray(p.centroid) && p.centroid.length >= 2) return [p.centroid[0], p.centroid[1]]
  let minX = 999, minY = 999, maxX = -999, maxY = -999, found = false
  const walk = coords => {
    if (typeof coords[0] === 'number') {
      found = true
      minX = Math.min(minX, coords[0]); maxX = Math.max(maxX, coords[0])
      minY = Math.min(minY, coords[1]); maxY = Math.max(maxY, coords[1])
    } else coords.forEach(walk)
  }
  if (f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates)
  return found ? [(minX + maxX) / 2, (minY + maxY) / 2] : null
}

function buildIndex(geojson) {
  // key 为 norm(name)；另挂「xx州」别名（parent 常写 红河州/恩施州 简写）
  const map = new Map()
  for (const f of geojson.features || []) {
    const key = norm(f.properties && f.properties.name)
    if (!key) continue
    if (!map.has(key)) map.set(key, f)
    const alias = `${key}州`
    if (!map.has(alias)) map.set(alias, f)
  }
  return map
}

// 精确 + 前缀模糊（旅顺↔旅顺口区、青阳九华山↔青阳县）
function findMatch(map, name) {
  const key = norm(name)
  if (!key || key.length < 2) return null
  const exact = map.get(key)
  if (exact) return exact
  let best = null
  for (const [k, f] of map) {
    if (k.length < 2) continue
    if (k.startsWith(key) || key.startsWith(k)) {
      if (!best || k.length > best[0].length) best = [k, f]
    }
  }
  return best ? best[1] : null
}

// ---- 主流程 ----
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const cities = data.cities
console.log(`共 ${cities.length} 条，开始解析坐标…`)

// 全国 -> 省份 adcode
const china = await fetchGeo(100000)
const provIndex = buildIndex(china)

// 省份名 -> { adcode, index, coord }
const provInfo = new Map()
async function getProvince(provName) {
  if (provInfo.has(provName)) return provInfo.get(provName)
  const f = findMatch(provIndex, provName)
  if (!f) throw new Error(`省份未匹配: ${provName}`)
  const adcode = f.properties.adcode
  const geo = await fetchGeo(adcode)
  const info = { adcode, index: buildIndex(geo), coord: featureCoord(f), geo }
  provInfo.set(provName, info)
  return info
}

// 地级市缓存：adcode -> index(区县)；无下级文件时为 null
const cityIndexCache = new Map()
async function getCityIndex(adcode) {
  if (!cityIndexCache.has(adcode)) {
    try {
      cityIndexCache.set(adcode, buildIndex(await fetchGeo(adcode)))
    } catch {
      cityIndexCache.set(adcode, null)
    }
  }
  return cityIndexCache.get(adcode)
}

// 县级 parent 全省 lazy 扫描：在省内各地级市 _full 中找该县，返回其坐标
const countyScanCache = new Map()
async function scanCounty(prov, countyName) {
  const cacheKey = `${prov.adcode}:${norm(countyName)}`
  if (countyScanCache.has(cacheKey)) return countyScanCache.get(cacheKey)
  let result = null
  for (const f of prov.geo.features || []) {
    const idx = await getCityIndex(f.properties.adcode)
    if (!idx) continue
    const hit = findMatch(idx, countyName)
    if (hit) { result = featureCoord(hit); break }
  }
  countyScanCache.set(cacheKey, result)
  return result
}

const coords = {}
const unmatched = []
const stats = { manual: 0, district: 0, city: 0, province: 0, scan: 0 }
const put = (id, coord, kind) => { coords[id] = coord; stats[kind]++ }

for (const c of cities) {
  // 0. 手工表优先
  if (MANUAL[c.id]) { put(c.id, MANUAL[c.id], 'manual'); continue }

  const prov = await getProvince(c.province)

  // 1. 直辖市本体（province === name）直接用省级中心
  if (c.province === c.name && !c.parent) { put(c.id, prov.coord, 'province'); continue }

  // 2. 无 parent：地级市 / 省直辖县级市，省级 features 匹配
  if (!c.parent) {
    const f = findMatch(prov.index, c.name)
    if (f) { put(c.id, featureCoord(f), 'city'); continue }
    unmatched.push({ id: c.id, name: c.name, province: c.province, parent: c.parent, reason: '省级未匹配' })
    continue
  }

  // 3. parent 为「省直辖…」或含「兵团」：直接在省级 features 匹配条目名
  if (c.parent.startsWith('省直辖') || c.parent.includes('兵团')) {
    const f = findMatch(prov.index, c.name)
    if (f) { put(c.id, featureCoord(f), 'city'); continue }
    unmatched.push({ id: c.id, name: c.name, province: c.province, parent: c.parent, reason: '省直辖/兵团未匹配' })
    continue
  }

  // 4. parent 即省名（直辖市区县，如 北京/房山）：省级 features 匹配条目名
  if (norm(c.parent) === norm(c.province)) {
    const f = findMatch(prov.index, c.name)
    if (f) { put(c.id, featureCoord(f), 'district'); continue }
    unmatched.push({ id: c.id, name: c.name, province: c.province, parent: c.parent, reason: '直辖市区未匹配' })
    continue
  }

  // 5. 组合 parent（如「雅安市荥经县」「临夏州永靖县」）：拆地级 + 县级
  const combo = c.parent.match(/^(.+?(?:市|州|地区|盟))(.+)$/)
  if (combo) {
    const pf = findMatch(prov.index, combo[1])
    if (pf) {
      const cityIdx = await getCityIndex(pf.properties.adcode)
      if (cityIdx) {
        const hit = findMatch(cityIdx, c.name) || findMatch(cityIdx, combo[2])
        if (hit) { put(c.id, featureCoord(hit), 'district'); continue }
      }
      put(c.id, featureCoord(pf), 'city'); continue
    }
  }

  // 6. 常规 parent：解析地级市 → 市级 features 匹配区县
  const pf = findMatch(prov.index, c.parent)
  if (pf) {
    if (norm(c.name) === norm(c.parent)) { put(c.id, featureCoord(pf), 'city'); continue }
    const cityIdx = await getCityIndex(pf.properties.adcode)
    if (cityIdx) {
      const hit = findMatch(cityIdx, c.name)
      if (hit) { put(c.id, featureCoord(hit), 'district'); continue }
    } else {
      // 该市无下级边界文件（省直辖县级市等），回退到 parent 坐标
      put(c.id, featureCoord(pf), 'city'); continue
    }
    // 市级未匹配（如腾冲市·和顺古镇）：回退 parent 坐标
    put(c.id, featureCoord(pf), 'city'); continue
  }

  // 7. 条目名在省级 features 的最后尝试（如 呼伦贝尔 parent=海拉尔区）
  const self = findMatch(prov.index, c.name)
  if (self) { put(c.id, featureCoord(self), 'city'); continue }

  // 8. parent 为县级：全省 lazy 扫描找该县，用县中心近似
  const scanned = await scanCounty(prov, c.parent)
  if (scanned) { put(c.id, scanned, 'scan'); continue }

  unmatched.push({ id: c.id, name: c.name, province: c.province, parent: c.parent, reason: '全部策略未匹配' })
}

writeFileSync(OUT_PATH, JSON.stringify(coords, null, 1))

console.log(`\n完成：匹配 ${Object.keys(coords).length}/${cities.length}`)
console.log(`  手工表 ${stats.manual} · 区县级 ${stats.district} · 地级/省直辖 ${stats.city} · 直辖市 ${stats.province} · 县级扫描回退 ${stats.scan}`)
if (unmatched.length) {
  console.log(`\n未匹配 ${unmatched.length} 条（需补 MANUAL 表）：`)
  for (const u of unmatched) console.log(`  '${u.id}': [?, ?],  // ${u.province}${u.parent ? ' / ' + u.parent : ''} · ${u.name} · ${u.reason}`)
}
