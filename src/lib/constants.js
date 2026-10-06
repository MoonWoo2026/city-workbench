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
  medical: c => (['一二线城市', '三四线城市'].includes(c.type) ? [1, '医疗资源较好'] : null),
  safety: c => (c.type !== '一二线城市' ? [1, '小城治安好'] : null),
}

export const SORTS = [
  { key: 'explore', label: '✨ 探索模式（每日轮换）' },
  { key: 'total', label: '月总支出 从低到高' },
  { key: 'single', label: '整租价格 从低到高' },
  { key: 'shared', label: '合租价格 从低到高' },
  { key: 'name', label: '城市名称 A-Z' },
]
