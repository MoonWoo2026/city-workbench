import { DEFAULT_LEVELS, TYPE_CODE_BY_NAME, PREFS, PREF_RANK } from './constants.js'

// ---------- 本地存储（收藏 / 笔记） ----------
const FAV_KEY = 'cw:favs'
const NOTE_KEY = 'cw:notes'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function loadFavs() {
  return new Set(read(FAV_KEY, []))
}
export function saveFavs(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]))
}
export function loadNotes() {
  return read(NOTE_KEY, {})
}
export function saveNotes(obj) {
  localStorage.setItem(NOTE_KEY, JSON.stringify(obj))
}

// ---------- 默认筛选状态 ----------
export function defaultFilters() {
  return {
    q: '',
    provinces: [],            // 空数组 = 全国
    levels: [...DEFAULT_LEVELS],
    types: [],                // 空数组 = 全选
    tags: [],                 // 标签之间为 AND（交集）
    cleanOnly: false,
    uniOnly: false,           // 大学城周边：可勾选过滤，默认不开启
    medOnly: false,           // 有三甲医院（本市或母城市区）
    medExcl: false,           // 排除有三甲医院的城市（AI 微调「不要三甲」）
    spec: null,               // 专科强院筛选：复旦 2023 专科声誉榜 key（如 xiaohua=消化病），只看有全国 Top10 强院的城市
    sort: 'explore',          // 默认探索模式：省份交错 + 每日轮换，首页不固定
    budget: null,             // 预算模式：{ mode:'single'|'shared', rent, food, utils, transit, other }，0=该项不限
    excl: [],                 // 微调排除：[{ label:'排除北方', provinces:[...] }]，可叠加多条
    prefs: [],                // 生活偏好排序加权：[prefId, ...]，AI 与筛选面板共用
  }
}

// ---------- 预算模式 ----------
// 每城生活成本分项估算：living = 月总支出 - 整租，再按固定比例拆分
export function budgetBreakdown(c, mode = 'single') {
  const rent = mode === 'shared' ? c.rent_shared : c.rent_single
  const living = Math.max(0, c.monthly_total - c.rent_single)
  const r10 = n => Math.round(n / 10) * 10
  return {
    rent,
    food: r10(living * 0.5),
    utils: r10(living * 0.18),
    transit: r10(living * 0.12),
    other: r10(living * 0.20),
    total: rent + living,
  }
}

// 总预算 → 默认拆分（房租 45% / 餐饮 27% / 杂费 9% / 交通 6% / 其他 13%，余项归房租保证合计=总预算）
export function splitBudget(total) {
  const t = Math.max(0, Math.round(total) || 0)
  const r50 = n => Math.round(n / 50) * 50
  const food = r50(t * 0.27)
  const utils = r50(t * 0.09)
  const transit = r50(t * 0.06)
  const other = r50(t * 0.13)
  return { rent: Math.max(0, t - food - utils - transit - other), food, utils, transit, other }
}

export function budgetTotal(b) {
  return b ? (b.rent || 0) + (b.food || 0) + (b.utils || 0) + (b.transit || 0) + (b.other || 0) : 0
}

export function matchBudget(c, b) {
  if (!b) return true
  const bk = budgetBreakdown(c, b.mode)
  for (const k of ['rent', 'food', 'utils', 'transit', 'other']) {
    if (b[k] > 0 && bk[k] > b[k]) return false
  }
  return true
}

// ---------- URL Query 编解码（用于分享完全一致的视图） ----------
export function encodeFilters(f) {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.provinces.length) p.set('p', f.provinces.join(','))
  // 房租档：默认前三档时省略参数，使链接更短
  const isDefaultLevels =
    f.levels.length === DEFAULT_LEVELS.length &&
    DEFAULT_LEVELS.every(k => f.levels.includes(k))
  if (!isDefaultLevels) p.set('l', f.levels.join(','))
  if (f.types.length) p.set('ty', f.types.join(','))
  if (f.tags.length) p.set('tag', f.tags.join(','))
  if (f.cleanOnly) p.set('clean', '1')
  if (f.medOnly) p.set('med', '1')
  if (f.medExcl) p.set('medx', '1')
  if (f.spec) p.set('sp', f.spec)
  if (f.uniOnly) p.set('uni', '1') // 默认开启，显式写入便于分享一致视图
  if (f.sort && f.sort !== 'explore') p.set('sort', f.sort) // explore 为默认排序，不写入 URL
  if (f.budget) p.set('b', [f.budget.mode, f.budget.rent, f.budget.food, f.budget.utils, f.budget.transit, f.budget.other].join('~'))
  if (f.excl?.length) p.set('x', f.excl.map(e => `${e.label}@${e.provinces.join('.')}`).join('|'))
  if (f.prefs?.length) p.set('pr', f.prefs.join(','))
  return p.toString()
}

export function decodeFilters(search) {
  const f = defaultFilters()
  const p = new URLSearchParams(search)
  const split = k => (p.get(k) ? p.get(k).split(',').filter(Boolean) : [])
  f.q = p.get('q') ?? ''
  f.provinces = split('p')
  if (p.has('l')) f.levels = split('l')
  f.types = split('ty')
  f.tags = split('tag')
  f.cleanOnly = p.get('clean') === '1'
  f.medOnly = p.get('med') === '1'
  f.medExcl = p.get('medx') === '1'
  f.spec = p.get('sp') || null
  f.uniOnly = p.get('uni') === '1'
  f.sort = p.get('sort') || f.sort // 未指定时用默认（explore）
  if (p.has('b')) {
    const [mode, ...nums] = p.get('b').split('~')
    const [rent, food, utils, transit, other] = nums.map(n => +n || 0)
    f.budget = { mode: mode === 'shared' ? 'shared' : 'single', rent, food, utils, transit, other }
  }
  if (p.has('x')) {
    f.excl = p.get('x').split('|').filter(Boolean).map(seg => {
      const [label, provs] = seg.split('@')
      return { label, provinces: (provs || '').split('.').filter(Boolean) }
    }).filter(e => e.provinces.length)
  }
  f.prefs = split('pr').filter(k => PREFS.some(pf => pf.id === k))
  return f
}

// 城市类型的可搜索别名：数据里存的是「一二线城市」这类合并名，
// 用户搜「一线」「三线城市」「小镇」等口语词时也能命中
const TYPE_ALIASES = {
  一二线城市: '一线 一线城市 二线城市 一二线 一线城 二线城 大城市 省会 大都市',
  一线郊区: '一线郊区 郊区 市郊 卫星城 城郊 一线 一线城市',
  二线郊区: '二线郊区 郊区 市郊 卫星城 城郊 二线 二线城市',
  三四线城市: '三线 三线城市 四线城市 三四线 三线城 四线城 五线 五线城市 中小城市 地级市',
  '县城/小镇': '县城 小镇 小城 乡镇 古镇 县镇 村里',
}

// ---------- 模糊搜索：城市名 / 拼音 / 省份 / 县区 / 推荐区域 / 标签 / 城市线级 ----------
export function matchQuery(city, q) {
  if (!q) return true
  const kw = q.trim().toLowerCase()
  if (!kw) return true
  const hay = [
    city.name,
    city.pinyin,
    city.province,
    city.parent,
    city.region,
    city.type,
    TYPE_ALIASES[city.type] || '',
    ...(city.areas || []),
    ...(city.tags || []),
    city.spectext || '', // 专科强院搜索文本（疾病别名+专科名+医院短名，构建时注入）
  ].join(' ').toLowerCase()
  return hay.includes(kw)
}

// ---------- 专科强院 ----------
// c.spec 条目：[specKey, rank, 医院短名]（同城同专科多家时有多条）
export function specEntries(city, key) {
  return (city.spec || []).filter(s => s[0] === key).sort((a, b) => a[1] - b[1])
}
export function specRank(city, key) {
  const es = specEntries(city, key)
  return es.length ? es[0][1] : 999
}

// ---------- 多维筛选 ----------
export function applyFilters(cities, f, { favs = null, favOnly = false } = {}) {
  const typeNames = new Set(f.types.map(code => {
    const byCode = { A: '一二线城市', B: '一线郊区', C: '二线郊区', D: '三四线城市', E: '县城/小镇' }
    return byCode[code] || code
  }))
  return cities.filter(c => {
    if (f.excl?.length && f.excl.some(e => e.provinces.includes(c.province))) return false // 微调排除优先
    if (f.levels.length && !f.q && !f.budget && !f.spec && !f.levels.includes(c.rent_level)) return false // 有关键词搜索/预算/专科模式时放开房租档位（更明确的意图）
    if (f.provinces.length && !f.provinces.includes(c.province)) return false
    if (f.types.length && !typeNames.has(c.type)) return false
    if (f.tags.length && !f.tags.every(t => c.tags.includes(t))) return false
    if (f.cleanOnly && !c.clean50) return false
    if (f.medOnly && !(c.med && (c.med.n > 0 || c.med.p > 0))) return false // 有三甲（本市或市区）
    if (f.medExcl && c.med && (c.med.n > 0 || c.med.p > 0)) return false // 排除有三甲
    if (f.spec && !(c.spec && c.spec.some(s => s[0] === f.spec))) return false // 专科强院所在城市（全国 Top10）
    if (f.uniOnly && !f.q && !f.budget && !f.spec && !c.uni_town) return false // 有关键词搜索/预算/专科模式时放开大学城限制
    if (favOnly && favs && !favs.has(c.id)) return false
    if (f.q && !matchQuery(c, f.q)) return false
    if (f.budget && !matchBudget(c, f.budget)) return false
    return true
  })
}

// 确定性伪随机（每日种子，同一天内结果稳定，跨天自动换一批）
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 生活偏好打分 ----------
export function prefScore(city, prefs) {
  if (!prefs?.length) return 0
  let score = 0
  for (const id of prefs) {
    const rank = PREF_RANK[id]
    if (!rank) continue
    const r = rank(city)
    if (r) score += r[0]
  }
  return score
}

export function sortCities(list, sort) {
  const arr = [...list]
  switch (sort) {
    case 'single':
      return arr.sort((a, b) => a.rent_single - b.rent_single)
    case 'shared':
      return arr.sort((a, b) => a.rent_shared - b.rent_shared)
    case 'name':
      return arr.sort((a, b) => a.pinyin.localeCompare(b.pinyin))
    case 'explore': {
      // 探索模式：省份交错 + 每日轮换种子。便宜仍然是主旋律，但各省轮流上前排，首页不再固定
      const seed = Math.floor(Date.now() / 86400000)
      const rnd = mulberry32(seed)
      const scored = arr.map(c => ({ c, k: c.monthly_total * (0.85 + rnd() * 0.3) }))
      const byProv = new Map()
      for (const s of scored) {
        const p = s.c.province
        if (!byProv.has(p)) byProv.set(p, [])
        byProv.get(p).push(s)
      }
      const groups = [...byProv.values()]
      for (const g of groups) g.sort((a, b) => a.k - b.k)
      groups.sort((a, b) => a[0].k - b[0].k) // 省份按各自最优价排序
      const out = []
      let i = 0, alive = true
      while (alive) {
        alive = false
        for (const g of groups) if (i < g.length) { out.push(g[i].c); alive = true }
        i++
      }
      return out
    }
    case 'total':
    default:
      return arr.sort((a, b) => a.monthly_total - b.monthly_total)
  }
}

export { TYPE_CODE_BY_NAME }
