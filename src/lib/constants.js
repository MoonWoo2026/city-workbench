// 筛选器常量定义

// 大区顺序（按需求文档列出的顺序）
export const REGION_ORDER = ['华东', '西南', '东北', '华南', '西北', '华中', '华北']

// 房租五档（key 与数据 rent_level 对应）
export const RENT_LEVELS = [
  { key: 'under_1000', label: '< 1000 元', hint: '超低租金' },
  { key: '1000_1700', label: '1000 – 1700 元', hint: '低成本舒适区' },
  { key: '1700_3000', label: '1700 – 3000 元', hint: '旅居主流' },
  { key: '3000_5000', label: '3000 – 5000 元', hint: '大城品质' },
  { key: 'above_5000', label: '5000 元以上', hint: '一线核心' },
]

// 居住模式
export const LIVING_TYPES = [
  { key: 'A', label: '一二线城市' },
  { key: 'B', label: '一线郊区' },
  { key: 'C', label: '二线郊区' },
  { key: 'D', label: '三四线城市' },
  { key: 'E', label: '县城/小镇' },
]

// 气候与特色标签
export const CLIMATE_TAGS = [
  { key: '南方湿润', icon: '💧' },
  { key: '北方干燥', icon: '🌾' },
  { key: '高原避暑', icon: '⛰️' },
  { key: '海滨沿海', icon: '🌊' },
  { key: '天然温泉', icon: '♨️' },
  { key: '供暖充沛', icon: '🔥' },
]

export const DEFAULT_LEVELS = ['under_1000', '1000_1700', '1700_3000']

export const TYPE_CODE_BY_NAME = Object.fromEntries(LIVING_TYPES.map(t => [t.label, t.key]))
export const TYPE_NAME_BY_CODE = Object.fromEntries(LIVING_TYPES.map(t => [t.key, t.label]))

// 生活偏好（AI 与筛选面板共用）
export const PREFS = [
  { id: 'rail', label: '通高铁/动车' },
  { id: 'air', label: '有机场' },
  { id: 'taxi', label: '打车方便' },
  { id: 'nomad', label: '数字游民友好' },
  { id: 'quiet', label: '安静慢节奏' },
  { id: 'nature', label: '自然风光好' },
  { id: 'mild', label: '气候温和' },
  { id: 'sun', label: '日照充足' },
  { id: 'delivery', label: '快递便利' },
  { id: 'food', label: '餐饮/外卖丰富' },
  { id: 'medical', label: '医疗资源好' },
  { id: 'safety', label: '治安良好' },
]

// 偏好 → 城市打分规则：返回 [加分, 理由] 或 null（供排序推荐用）
// 注意：city.type 存的是中文名（一二线城市/一线郊区/二线郊区/三四线城市/县城·小镇）
export const PREF_RANK = {
  rail: c => (c.transit?.rail && !/未通|暂无|无站|没有站|不通/.test(c.transit.rail)) ? [2, '有高铁/动车'] : null,
  air: c => (c.transit?.air && !/无机场|需到|最近.{0,4}机场|没有机场/.test(c.transit.air)) ? [2, '有机场或邻近机场'] : null,
  taxi: c => (c.transit?.taxi && !/无出租|没有出租|无网约车/.test(c.transit.taxi)) ? [1, '打车方便'] : null,
  nomad: c => /游民|咖啡馆多|咖啡馆密集|咖啡馆林立/.test(c.net?.cowork || '') ? [2, '数字游民友好'] : null,
  quiet: c => (c.type === '县城/小镇' ? [2, '县城/小镇节奏慢'] : c.type === '三四线城市' ? [1, '三四线不拥挤'] : null),
  nature: c => (c.clean50 ? [1, '50km 内无重污染'] : null),
  mild: c => (c.tags.includes('高原避暑') ? [1, '气候温和'] : null),
  sun: c => (c.tags.includes('北方干燥') ? [1, '日照充足'] : null),
  delivery: c => (c.type !== '县城/小镇' ? [1, '快递便利'] : null),
  food: c => (['一二线城市', '三四线城市'].includes(c.type) ? [1, '餐饮/外卖较丰富'] : null),
  medical: c => {
    if (c.med?.n > 0) return [2, `三甲医院 ${c.med.n} 家`]
    if (c.med?.p > 0) return [1, `邻市三甲医院 ${c.med.p} 家`]
    return null
  },
  safety: c => {
    if (c.safety?.security && typeof c.safety.security === 'number') return [3, `群众安全感 ${c.safety.security}%`]
    if (c.safety?.security) return [2, '治安居前列']
    if (c.safety?.securityTrend) return [2, '群众安全感连年上升']
    if (c.border) return [-1, '边境城市']
    return [1, '非边境地区']
  },
}

export const SORTS = [
  { key: 'explore', label: '✨ 探索模式（每日轮换）' },
  { key: 'total', label: '月总支出 从低到高' },
  { key: 'single', label: '整租价格 从低到高' },
  { key: 'shared', label: '合租价格 从低到高' },
  { key: 'name', label: '城市名称 A-Z' },
]

// PM2.5 周均浓度分级（阈值参照 GB3095-2012 日均浓度限值，周均值按同阈值定性）
// 数据来自 Open-Meteo Air Quality API（Copernicus CAMS），每周自动更新
export const PM25_LEVELS = [
  { key: 'good', label: '优', max: 35, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  { key: 'moderate', label: '良', max: 75, cls: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-500' },
  { key: 'light', label: '轻度污染', max: 115, cls: 'bg-orange-50 text-orange-700 ring-orange-500/25', dot: 'bg-orange-500' },
  { key: 'medium', label: '中度污染', max: 150, cls: 'bg-red-50 text-red-700 ring-red-500/25', dot: 'bg-red-500' },
  { key: 'heavy', label: '重度污染', max: 250, cls: 'bg-rose-100 text-rose-800 ring-rose-700/30', dot: 'bg-rose-600' },
  { key: 'severe', label: '严重污染', max: Infinity, cls: 'bg-purple-100 text-purple-900 ring-purple-700/30', dot: 'bg-purple-700' },
]

export function pm25Level(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return PM25_LEVELS.find(l => v <= l.max) || PM25_LEVELS[PM25_LEVELS.length - 1]
}

// 公共服务保障评级（综合财政自给度 + 人均民生支出 + 基建投资活跃度）
// 包装口径：避免「赤字/债务」字眼，对外呈现为公共服务保障水平
// 数据为基于公开财政决算规律的模型估算，每年随统计公报更新
export const FISCAL_GRADES = [
  { key: 'A', label: '保障充足', min: 0.85, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', desc: '财政自给度高，人均民生支出与基建投入在同类城市中靠前' },
  { key: 'B', label: '保障良好', min: 0.70, cls: 'bg-sky-50 text-sky-700 ring-sky-500/20', dot: 'bg-sky-500', desc: '收支基本平衡，公共服务投入稳步增长' },
  { key: 'C', label: '保障一般', min: 0.50, cls: 'bg-amber-50 text-amber-700 ring-amber-500/20', dot: 'bg-amber-500', desc: '自给率偏低，依赖上级转移支付，公共服务供给承压' },
  { key: 'D', label: '保障偏弱', min: 0, cls: 'bg-rose-50 text-rose-700 ring-rose-500/25', dot: 'bg-rose-500', desc: '收支缺口较大，公共服务建设需更多外部支持' },
]

export function fiscalGrade(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  return FISCAL_GRADES.find(g => score >= g.min) || FISCAL_GRADES[FISCAL_GRADES.length - 1]
}

