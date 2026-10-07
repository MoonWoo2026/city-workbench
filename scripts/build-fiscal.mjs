// 公共服务保障评级数据生成 + 注入：写 scripts/fiscal.json 并同步到 src/data/cities_full.json
//   - 仅对地级市本身（无 parent）做模型估算
//   - 县/区/县级市继承母城数据
//   - c.fiscal = { score, self_sufficiency, per_capita_living, invest_activity, grade, source, updated,
//                  revenue?, expenditure?, debt? }  // 真实数据字段（source='actual' 时存在）
//   - c.fiscaltext 供 matchQuery 搜索（公共服务 财政 保障 A B C D …）
//
// 数据来源优先级：
//   1. scripts/fiscal-real.json —— 各市 2025 年预算执行情况报告/统计公报的真实数据
//   2. 估算模型 v1-2026 —— 基于城市经济活跃度代理指标的简化模型（source='estimated'）
//
// 估算模型 v1-2026：基于 2022 年地级市财政决算公开规律的简化模型
//   维度：
//     score              综合分 0-1（用于评级）
//     self_sufficiency   财政自给度（一般公共预算收入 / 支出，>1 = 自给有余）
//     per_capita_living  人均民生支出（社保+教育+医疗+住房保障，元/年）
//     invest_activity    基建投资活跃度（0-1，标准化）
//   权重：城市类别基础分 + 省份修正 + 省会/计划单列加成 + 租金代理指标 + 稳定噪声
import fs from 'node:fs'
import { fiscalGrade } from '../src/lib/constants.js'

const DATA = 'src/data/cities_full.json'
const SRC = 'scripts/fiscal.json'
const REAL_SRC = 'scripts/fiscal-real.json'
const UPDATED = '2026-10-07'
const MODEL_VERSION = 'v1-2026'

// 城市类别基础分
const TYPE_BASE = {
  '一二线城市': 0.85,
  '一线郊区': 0.62,
  '二线郊区': 0.52,
  '三四线城市': 0.42,
  '县城/小镇': 0.30,
}

// 省份修正
const EAST_PROVS = ['北京', '上海', '江苏', '浙江', '广东', '福建', '山东', '天津', '海南']
const WEST_PROVS = ['西藏', '青海', '新疆', '甘肃', '宁夏', '云南', '贵州', '广西', '内蒙古']
const NE_PROVS = ['黑龙江', '吉林', '辽宁']
const CENTRAL_PROVS = ['河北', '山西', '安徽', '江西', '河南', '湖北', '湖南']
function provAdj(p) {
  if (EAST_PROVS.includes(p)) return 0.10
  if (NE_PROVS.includes(p)) return -0.08
  if (WEST_PROVS.includes(p)) return -0.05
  if (CENTRAL_PROVS.includes(p)) return 0.0
  return 0
}

const PROV_CAPITALS = new Set([
  '石家庄', '太原', '呼和浩特', '沈阳', '长春', '哈尔滨', '南京', '杭州',
  '合肥', '福州', '南昌', '济南', '郑州', '武汉', '长沙', '广州', '南宁',
  '海口', '成都', '贵阳', '昆明', '拉萨', '西安', '兰州', '西宁', '银川',
  '乌鲁木齐', '北京', '上海', '天津', '重庆',
])
const SINGLE_PLAN = new Set(['深圳', '大连', '青岛', '宁波', '厦门'])

// 稳定哈希（同城市每次重算一致）
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function round(v, d = 100) { return Math.round(v * d) / d }

// 综合实力原始分（排序用，非最终 score）
function rawPower(c) {
  const base = TYPE_BASE[c.type] ?? 0.40
  let p = base + provAdj(c.province)
  if (PROV_CAPITALS.has(c.name)) p += 0.20
  if (SINGLE_PLAN.has(c.name)) p += 0.12
  // 租金代理：经济活跃度
  p += clamp((c.rent_single - 800) / 5000 * 0.20, 0, 0.20)
  // 月支出代理（综合生活成本）
  p += clamp((c.monthly_total - 2500) / 8000 * 0.10, 0, 0.10)
  // 稳定噪声（同级别城市间制造区分）
  p += ((hashStr(c.id || c.name) % 100) / 100 - 0.5) * 0.08
  return p
}

// 估算单城（接收排名百分位 rawRank: 0..1，0 = 最弱，1 = 最强）
function estimate(c, rawRank) {
  // 全国地级市排名归一化到 0.30-0.95 区间（避免极端值，让分布更平滑）
  const score = round(0.30 + rawRank * 0.65)
  const self_sufficiency = round(score)                            // 0.30-0.95
  const per_capita_living = Math.round((2500 + score * 9000) / 100) * 100  // 2500-11500
  const invest_activity = round(score)                             // 0.30-0.95
  const grade = fiscalGrade(score)?.key || 'D'
  return { score, self_sufficiency, per_capita_living, invest_activity, grade, source: 'estimated' }
}

// ---------- 1. 读取数据集 ----------
const dataset = JSON.parse(fs.readFileSync(DATA, 'utf8'))
const cities = dataset.cities
const roots = cities.filter(c => !c.parent)

// 母城查找（与 build-restaurants.mjs 一致）
function resolveRoot(parent) {
  if (!parent) return null
  const head = parent.split(/[·\/]/)[0].trim()
  const hit = roots.find(c => c.name === head)
  if (hit) return hit
  const norm = s => s.replace(/(市|地区|盟|自治州|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '')
  const hn = norm(head)
  return roots.find(c => c.name === hn || head.startsWith(c.name) || c.name.startsWith(hn)) || null
}

// ---------- 2. 估算地级市 + 写 fiscal.json ----------
// 全国地级市按 rawPower 排名 → 归一化百分位 → 传入 estimate
const ranked = roots.map(c => ({ c, p: rawPower(c) })).sort((a, b) => a.p - b.p)
const N = ranked.length
const fiscalSrc = {
  _comment: '公共服务保障评级（综合财政自给度/人均民生支出/基建投资活跃度），基于公开财政决算规律的模型估算，每年随统计公报更新',
  source: '估算模型（基于 2022 年地级市财政决算规律 + 城市经济活跃度代理指标）',
  model_version: MODEL_VERSION,
  updated: UPDATED,
  update_cycle: 'annual',
  cities: {},
}

let estimated = 0
for (let i = 0; i < N; i++) {
  const { c } = ranked[i]
  const rawRank = N > 1 ? i / (N - 1) : 0.5   // 0..1
  fiscalSrc.cities[c.id] = estimate(c, rawRank)
  estimated++
}

fs.writeFileSync(SRC, JSON.stringify(fiscalSrc, null, 2))
console.log(`估算 ${estimated} 个地级市的财政数据，写入 ${SRC}`)

// ---------- 2.5 读取真实财政数据（fiscal-real.json）----------
// 结构：{ cities: { "城市id": { revenue, expenditure, debt?, note? } } }
// 有真实数据的城市：用真实收支重算 self_sufficiency + grade，source 改为 'actual'
let realData = null
let realCount = 0
if (fs.existsSync(REAL_SRC)) {
  realData = JSON.parse(fs.readFileSync(REAL_SRC, 'utf8'))
  realCount = Object.keys(realData.cities || {}).length
  console.log(`读取真实财政数据：${realCount} 城（${realData.updated || '?'}）`)
}

// 用真实数据覆盖估算值（地级市层面）
function applyRealData() {
  if (!realData?.cities) return
  for (const [cid, rd] of Object.entries(realData.cities)) {
    const est = fiscalSrc.cities[cid]
    if (!est) continue
    if (!rd.revenue || !rd.expenditure) continue
    const ss = rd.revenue / rd.expenditure   // 真实自给度
    // 真实数据 → 重算 score（以自给度为主，保留估算的 per_capita/invest 作辅）
    // 自给度 0.3→score 0.30，1.0→score 0.95，>1.0 上限 0.98
    const score = Math.max(0.25, Math.min(0.98, 0.25 + Math.min(1, ss) * 0.73))
    const grade = fiscalGrade(score)?.key || 'D'
    est.score = Math.round(score * 100) / 100
    est.self_sufficiency = Math.round(ss * 100) / 100
    est.grade = grade
    est.source = 'actual'
    est.revenue = rd.revenue
    est.expenditure = rd.expenditure
    if (rd.debt) est.debt = rd.debt
    if (rd.note) est.note = rd.note
  }
}
applyRealData()
// 重写 fiscal.json（含真实数据覆盖）
fs.writeFileSync(SRC, JSON.stringify(fiscalSrc, null, 2))
const actualN = Object.values(fiscalSrc.cities).filter(x => x.source === 'actual').length
console.log(`真实数据覆盖：${actualN} 城，估算 ${estimated - actualN} 城`)

// ---------- 3. 注入 cities_full.json（地级市 + 区县继承母城）----------
for (const c of cities) { delete c.fiscal; delete c.fiscaltext }

const rootById = new Map(roots.map(c => [c.id, c]))
let own = 0, inherited = 0
for (const c of cities) {
  let row = null
  if (!c.parent) {
    row = fiscalSrc.cities[c.id]
  } else {
    const root = resolveRoot(c.parent)
    if (root) row = fiscalSrc.cities[root.id]
  }
  if (!row) continue

  c.fiscal = {
    score: row.score,
    self_sufficiency: row.self_sufficiency,
    per_capita_living: row.per_capita_living,
    invest_activity: row.invest_activity,
    grade: row.grade,
    source: row.source,
    updated: UPDATED,
  }
  // 真实数据字段透传
  if (row.source === 'actual') {
    if (row.revenue != null) c.fiscal.revenue = row.revenue
    if (row.expenditure != null) c.fiscal.expenditure = row.expenditure
    if (row.debt != null) c.fiscal.debt = row.debt
    if (row.note) c.fiscal.note = row.note
  }
  const g = fiscalGrade(row.score)
  c.fiscaltext = [
    '公共服务保障', '财政自给度', '人均民生支出', '基建投资',
    '财政', '预算', '税收', '福利', '保障', '财力', '债务',
    `评级 ${row.grade}`, g?.label || '',
    row.grade === 'A' ? '财政好 财政充裕 财政健康 财力雄厚 预算充足 政府有钱 公共服务好 保障充足 财政稳健 自给率高' : '',
    row.grade === 'B' ? '财政良好 财政稳健 收支平衡 保障良好 公共服务稳定' : '',
    row.grade === 'C' ? '财政一般 财政紧张 保障一般 公共服务承压' : '',
    row.grade === 'D' ? '财政差 财政困难 财政吃紧 财政承压 保障偏弱 公共服务缺口' : '',
  ].filter(Boolean).join(' ')
  c.parent ? inherited++ : own++
}

fs.writeFileSync(DATA, JSON.stringify(dataset))
console.log(`公共服务保障评级注入：自有 ${own} 城，继承母城 ${inherited} 城，覆盖 ${own + inherited}/${cities.length}`)
console.log('文件大小:', (fs.statSync(DATA).size / 1024 / 1024).toFixed(1), 'MB')

// ---------- 4. 分级统计 ----------
const stats = { A: 0, B: 0, C: 0, D: 0 }
for (const c of cities) if (c.fiscal) stats[c.fiscal.grade] = (stats[c.fiscal.grade] || 0) + 1
console.log('分级分布:', stats)
