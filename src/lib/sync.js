// 云端同步：收藏 + 备忘录 + 筛选偏好
// 存储：value-invest 服务 /api/city（仅作者 key 可读写）
// 合并策略：整包 last-write-wins（按 updated 毫秒时间戳比较）
const LS_KEY = 'cw:key'
const LS_API = 'cw:apiBase'
const LS_UPDATED = 'cw:updated'
const DEFAULT_API = 'https://value-invest-agtn.onrender.com'

let onStatus = () => {}
export function setStatusListener(fn) { onStatus = fn }
function emit(s) { try { onStatus(s) } catch { /* noop */ } }

export function getKey() { return localStorage.getItem(LS_KEY) || '' }
export function setKey(k) {
  k ? localStorage.setItem(LS_KEY, k) : localStorage.removeItem(LS_KEY)
}
export function getApiBase() {
  return (localStorage.getItem(LS_API) || DEFAULT_API).replace(/\/+$/, '')
}

// 模块加载即捕获 URL 里的 ?key= / ?api= / ?admin=1（App 的筛选同步随后会重写 URL）
;(function captureFromUrl() {
  try {
    const sp = new URLSearchParams(window.location.search)
    const k = sp.get('key')
    if (k) setKey(k.trim())
    const api = sp.get('api')
    if (api) localStorage.setItem(LS_API, api.trim())
    // 主人模式入口：URL 带 ?admin=1 即永久激活本地 admin 标记（私人链接，仅自己用）
    if (sp.get('admin') === '1') localStorage.setItem('cw:admin', '1')
  } catch { /* noop */ }
})()

export function localUpdated() { return Number(localStorage.getItem(LS_UPDATED) || 0) }
export function setLocalUpdated(ts) { localStorage.setItem(LS_UPDATED, String(ts)) }

async function req(method, body) {
  const res = await fetch(getApiBase() + '/api/city', {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getKey() ? { 'X-Share-Key': getKey() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 403) { const e = new Error('forbidden'); e.code = 403; throw e }
  if (!res.ok) throw new Error('http ' + res.status)
  return res.json()
}

// 拉取远端；无远端数据返回 null
export async function pullRemote() {
  const d = await req('GET')
  if (!d || typeof d !== 'object' || !d.updated) return null
  return {
    favs: Array.isArray(d.favs) ? d.favs : [],
    notes: (d.notes && typeof d.notes === 'object') ? d.notes : {},
    filters: (d.filters && typeof d.filters === 'object') ? d.filters : null,
    updated: Number(d.updated) || 0,
  }
}

let timer = null
let pending = null

// 变更后防抖推送（1.5s 合并连续操作）
export function pushSoon(state) {
  pending = state
  setLocalUpdated(Date.now())
  clearTimeout(timer)
  timer = setTimeout(pushNow, 1500)
}

export async function pushNow() {
  if (!pending) return // 无待推数据时保持现状（避免覆盖 doPull 刚设的 noauth/error）
  const body = pending
  pending = null
  emit('syncing')
  try {
    const r = await req('POST', body)
    if (r && r.updated) setLocalUpdated(r.updated)
    emit('ok')
  } catch (e) {
    emit(e.code === 403 ? 'noauth' : 'error')
  }
}
