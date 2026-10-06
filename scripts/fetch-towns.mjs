// 抓取已收录地级市的下辖县/县级市/镇（直筒子市）→ scripts/towns.json
// 数据源：DataV 行政区划 GeoJSON（与 coords 同源，GCJ-02 坐标），带 .geo-cache 本地缓存
// 注意：读取的是生成产物 cities_full.json；新加地级市后需重跑本脚本再 npm run gen
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE = resolve(__dirname, '.geo-cache')
mkdirSync(CACHE, { recursive: true })

const PROV_ADCODE = {
  北京: 110000, 天津: 120000, 河北: 130000, 山西: 140000, 内蒙古: 150000,
  辽宁: 210000, 吉林: 220000, 黑龙江: 230000, 上海: 310000, 江苏: 320000,
  浙江: 330000, 安徽: 340000, 福建: 350000, 江西: 360000, 山东: 370000,
  河南: 410000, 湖北: 420000, 湖南: 430000, 广东: 440000, 广西: 450000,
  海南: 460000, 重庆: 500000, 四川: 510000, 贵州: 520000, 云南: 530000,
  西藏: 540000, 陕西: 610000, 甘肃: 620000, 青海: 630000, 宁夏: 640000, 新疆: 650000,
}

// 名字核心词：去掉行政后缀和民族成分，用于「中山」↔「中山市」、「红河」↔「红河哈尼族彝族自治州」匹配
const core = s => s
  .replace(/(特别行政区|省|市|地区|盟|自治州|自治县|区|县|旗)$/, '')
  .replace(/(维吾尔|哈萨克|柯尔克孜|朝鲜|蒙古|藏|回|壮|苗|彝|侗|白|傣|哈尼|土家|黎|羌|土|裕固|东乡|撒拉|保安|满|布依|佤|拉祜|纳西|景颇|傈僳|布朗|仫佬|毛南|仡佬|锡伯|阿昌|普米|塔吉克|怒|德昂|京|独龙|鄂伦春|赫哲|门巴|珞巴|基诺|达斡尔|鄂温克)族?/g, '')

// 直筒子市在 DataV 无下级边界，用 Nominatim(OSM) 逐个地理编码 + WGS-84→GCJ-02 纠偏
// 名单手工维护：中山/东莞/儋州/嘉峪关的镇（不含主城区街道；南朗/民众 2021 改街道但民间仍按镇称呼）
const SPECIAL_TOWNS = {
  中山: ['南朗', '民众', '小榄镇', '古镇镇', '横栏镇', '大涌镇', '沙溪镇', '三乡镇', '板芙镇', '神湾镇', '坦洲镇', '黄圃镇', '南头镇', '东凤镇', '阜沙镇', '三角镇', '港口镇'],
  东莞: ['虎门镇', '长安镇', '厚街镇', '沙田镇', '道滘镇', '洪梅镇', '麻涌镇', '中堂镇', '望牛墩镇', '高埗镇', '石碣镇', '石龙镇', '茶山镇', '石排镇', '企石镇', '横沥镇', '桥头镇', '谢岗镇', '东坑镇', '常平镇', '寮步镇', '大朗镇', '大岭山镇', '黄江镇', '樟木头镇', '清溪镇', '塘厦镇', '凤岗镇'],
  儋州: ['白马井镇', '中和镇', '新州镇', '东成镇', '兰洋镇', '南丰镇', '光村镇', '海头镇', '排浦镇', '木棠镇', '峨蔓镇', '王五镇', '雅星镇', '大成镇', '和庆镇'],
  嘉峪关: ['峪泉镇', '新城镇', '文殊镇'],
}

// WGS-84 → GCJ-02（火星坐标系纠偏，使 OSM 点位贴合高德瓦片）
const PI = 3.14159265358979324, AX = 6378245.0, EE = 0.00669342162296594323
function tLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
  r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3
  return r
}
function tLng(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
  r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3
  return r
}
function wgs2gcj(lng, lat) {
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35)
  const radLat = lat / 180 * PI
  let magic = Math.sin(radLat); magic = 1 - EE * magic * magic
  const sq = Math.sqrt(magic)
  dLat = (dLat * 180) / ((AX * (1 - EE)) / (magic * sq) * PI)
  dLng = (dLng * 180) / (AX / sq * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}

async function geocodeTown(name, parent, province) {
  const key = `nom_${province}_${parent}_${name}`.replace(/\//g, '_')
  const f = resolve(CACHE, `${key}.json`)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'))
  const q = encodeURIComponent(`${name}, ${parent}市, ${province}, 中国`)
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
    headers: { 'User-Agent': 'city-workbench-dev (personal project)' },
  })
  if (!r.ok) throw new Error(`nominatim ${name}: ${r.status}`)
  const arr = await r.json()
  await new Promise(s => setTimeout(s, 1100)) // Nominatim 限流 1/s
  const hit = arr[0]
  const res = hit ? { lng: Number(hit.lon), lat: Number(hit.lat), found: hit.display_name } : null
  writeFileSync(f, JSON.stringify(res))
  return res
}

async function geo(adcode) {
  const f = resolve(CACHE, `${adcode}.json`)
  if (!existsSync(f)) {
    const r = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`)
    if (!r.ok) throw new Error(`fetch ${adcode}: ${r.status}`)
    writeFileSync(f, JSON.stringify(await r.json()))
    await new Promise(s => setTimeout(s, 100))
  }
  return JSON.parse(readFileSync(f, 'utf8'))
}

const data = JSON.parse(readFileSync(resolve(__dirname, '../src/data/cities_full.json'), 'utf8'))
// 地级市根节点（无 parent 的一二线 / 三四线城市）
const roots = data.cities.filter(c => !c.parent && (c.type === '一二线城市' || c.type === '三四线城市'))
// 「已收录」只算手工精编条目（有拼音）；扩展生成的条目拼音为空，必须重新纳入，保证 towns.json 自包含
const existing = new Set(data.cities.filter(c => c.pinyin).map(c => `${c.province}|${c.name}`))

const out = []
let skipped = 0, noBoundary = 0
for (const root of roots) {
  const padc = PROV_ADCODE[root.province]
  if (!padc) continue
  const prov = await geo(padc)
  let city
  if (root.name === root.province) {
    city = prov // 直辖市：省级文件的 children 就是区/县
  } else {
    const me = prov.features.find(f => core(f.properties.name) === root.name)
    if (!me) { noBoundary++; continue } // 省直辖县级市等（如济源）没有下级边界，跳过
    try { city = await geo(me.properties.adcode) } catch { city = null }
  }
  if (!city && SPECIAL_TOWNS[root.name]) {
    // 直筒子市：DataV 无镇级边界，改用名单 + Nominatim 编码
    for (const name of SPECIAL_TOWNS[root.name]) {
      if (existing.has(`${root.province}|${name}`)) { skipped++; continue }
      const g = await geocodeTown(name, root.name, root.province)
      if (!g) { console.log('编码失败:', root.name, name); continue }
      const [lng, lat] = wgs2gcj(g.lng, g.lat)
      out.push({ province: root.province, parent: root.name, name, kind: '镇', adcode: null, lng, lat })
    }
    continue
  }
  if (!city) { console.log('拉取下辖失败:', root.name); continue }
  const kids = city.features.map(f => f.properties).filter(p => p.name && Array.isArray(p.center))
  const hasDistricts = kids.some(p => /[区县市旗]$/.test(p.name))
  // 市辖区：全部城市都拆分（用户要求单列市辖区）
  const allowQu = true
  for (const k of kids) {
    // 普通地级市：收县/自治县/旗 + 县级市；三四线城市另收市辖区
    // 直筒子市（中山/东莞/嘉峪关/儋州等，无区县）：收镇（街道为主城区，跳过）
    const kind = hasDistricts
      ? (/[县旗]$/.test(k.name) ? '县' : (/市$/.test(k.name) && k.name !== root.name ? '县级市' : (allowQu && /区$/.test(k.name) ? '区' : null)))
      : (/镇$/.test(k.name) ? '镇' : null)
    if (!kind) continue
    const short = k.name.replace(/(市|县|旗|区)$/, '')
    if (existing.has(`${root.province}|${k.name}`) || existing.has(`${root.province}|${short}`)) { skipped++; continue }
    out.push({
      province: root.province, parent: root.name, name: k.name, kind,
      adcode: k.adcode, lng: k.center[0], lat: k.center[1],
    })
  }
}
writeFileSync(resolve(__dirname, 'towns.json'), JSON.stringify(out, null, 1))
console.log(`地级根城市 ${roots.length} 个（无下级边界跳过 ${noBoundary}），新增下辖单位 ${out.length} 个，已收录跳过 ${skipped} 个`)
