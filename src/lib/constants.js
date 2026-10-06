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

export const SORTS = [
  { key: 'explore', label: '✨ 探索模式（每日轮换）' },
  { key: 'total', label: '月总支出 从低到高' },
  { key: 'single', label: '整租价格 从低到高' },
  { key: 'shared', label: '合租价格 从低到高' },
  { key: 'name', label: '城市名称 A-Z' },
]
