import { DEFAULT_LEVELS, TYPE_CODE_BY_NAME } from './constants.js'

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
    uniOnly: true,            // 个人偏好：优先大学城周边住宿
    sort: 'total',
  }
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
  if (f.uniOnly) p.set('uni', '1') // 默认开启，显式写入便于分享一致视图
  if (f.sort && f.sort !== 'total') p.set('sort', f.sort)
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
  f.uniOnly = !p.has('uni') || p.get('uni') === '1'
  f.sort = p.get('sort') || 'total'
  return f
}

// ---------- 模糊搜索：城市名 / 拼音 / 省份 / 县区 / 推荐区域 / 标签 ----------
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
    ...(city.areas || []),
    ...(city.tags || []),
  ].join(' ').toLowerCase()
  return hay.includes(kw)
}

// ---------- 多维筛选 ----------
export function applyFilters(cities, f, { favs = null, favOnly = false } = {}) {
  const typeNames = new Set(f.types.map(code => {
    const byCode = { A: '一二线城市', B: '一线郊区', C: '二线郊区', D: '三四线城市', E: '县城/小镇' }
    return byCode[code] || code
  }))
  return cities.filter(c => {
    if (f.levels.length && !f.q && !f.levels.includes(c.rent_level)) return false // 有关键词搜索时放开房租档位（同 uniOnly：搜索是更明确的意图）
    if (f.provinces.length && !f.provinces.includes(c.province)) return false
    if (f.types.length && !typeNames.has(c.type)) return false
    if (f.tags.length && !f.tags.every(t => c.tags.includes(t))) return false
    if (f.cleanOnly && !c.clean50) return false
    if (f.uniOnly && !f.q && !c.uni_town) return false // 有关键词搜索时放开大学城限制（搜索是更明确的意图）
    if (favOnly && favs && !favs.has(c.id)) return false
    if (f.q && !matchQuery(c, f.q)) return false
    return true
  })
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
    case 'total':
    default:
      return arr.sort((a, b) => a.monthly_total - b.monthly_total)
  }
}

export { TYPE_CODE_BY_NAME }
