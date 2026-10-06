import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Search, SlidersHorizontal, LayoutGrid, List, Share2, Link2, Scale, X,
  Heart, GraduationCap, Compass, MapPinned, ChevronUp, Map as MapIcon,
  Cloud, CloudOff, RefreshCw, Wallet,
} from 'lucide-react'
import dataset from './data/cities_full.json'
import { SORTS, DEFAULT_LEVELS } from './lib/constants.js'
import {
  defaultFilters, decodeFilters, encodeFilters, applyFilters, sortCities,
  loadFavs, saveFavs, loadNotes, saveNotes,
} from './lib/store.js'
import * as sync from './lib/sync.js'
import FilterPanel from './components/FilterPanel.jsx'
import StatBar from './components/StatBar.jsx'
import { CityCard, CityRow } from './components/CityCard.jsx'
import CityDetailModal from './components/CityDetailModal.jsx'
import CompareModal from './components/CompareModal.jsx'
import MapView from './components/MapView.jsx'
import Assistant from './components/Assistant.jsx'
import BudgetModal from './components/BudgetModal.jsx'
import { budgetTotal } from './lib/store.js'
import { useCityShare } from './components/useCityShare.jsx'

const PAGE_SIZE = 60

export default function App() {
  const all = dataset.cities

  const [filters, setFilters] = useState(() => decodeFilters(window.location.search))
  const [favs, setFavs] = useState(() => loadFavs())
  const [notes, setNotes] = useState(() => loadNotes())
  const [compareIds, setCompareIds] = useState([])
  const [detailId, setDetailId] = useState(null)
  // 卡片分享：生成 PNG 图片（可转发微信），列表/网格卡片共用这一个控制器
  const shareCtl = useCityShare()
  const [showCompare, setShowCompare] = useState(false)
  const [view, setView] = useState(() => localStorage.getItem('cw:view') || 'grid')
  const [favOnly, setFavOnly] = useState(false)
  const [mobileFilter, setMobileFilter] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [filterOpen, setFilterOpen] = useState(() => localStorage.getItem('cw:filterOpen') !== '0')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [toast, setToast] = useState('')
  const [syncStatus, setSyncStatus] = useState('off')

  // ---- 云端同步（收藏/备忘录/筛选偏好 → value-invest /api/city） ----
  const applyingRemote = useRef(false)
  const bootHadParams = useRef(!!window.location.search)
  const stateRef = useRef(null)
  stateRef.current = () => ({ favs: [...favs], notes, filters })

  const doPull = useCallback(async () => {
    if (!sync.getKey()) { setSyncStatus('off'); return }
    setSyncStatus('syncing')
    try {
      const remote = await sync.pullRemote()
      if (!remote) {
        sync.pushSoon(stateRef.current())
        return
      }
      if (remote.updated > sync.localUpdated()) {
        // 远端更新 → 应用到本地（分享链接带参数时不覆盖筛选）
        applyingRemote.current = true
        const favSet = new Set(remote.favs)
        setFavs(favSet); saveFavs(favSet)
        setNotes(remote.notes); saveNotes(remote.notes)
        if (!bootHadParams.current && remote.filters) {
          setFilters(f => ({ ...f, ...remote.filters }))
        }
        sync.setLocalUpdated(remote.updated)
        setTimeout(() => { applyingRemote.current = false }, 0)
        setSyncStatus('ok')
      } else if (sync.localUpdated() > remote.updated) {
        sync.pushSoon(stateRef.current()) // 本地更新 → 推上去
      } else {
        setSyncStatus('ok')
      }
    } catch (e) {
      setSyncStatus(e.code === 403 ? 'noauth' : 'error')
    }
  }, [])

  useEffect(() => {
    sync.setStatusListener(setSyncStatus)
    doPull()
  }, [doPull])

  // 本地变更 → 防抖推送（依赖快照守卫：仅引用真变化才推，免疫 StrictMode 双挂载重放）
  const prevSyncDep = useRef([favs, notes, filters])
  useEffect(() => {
    const prev = prevSyncDep.current
    prevSyncDep.current = [favs, notes, filters]
    if (prev[0] === favs && prev[1] === notes && prev[2] === filters) return
    if (applyingRemote.current || !sync.getKey()) return
    sync.pushSoon(stateRef.current())
  }, [favs, notes, filters])

  const onSyncClick = useCallback(() => {
    if (!sync.getKey()) {
      const k = window.prompt('输入作者 key（与价值投资同一枚 owner key），留空则取消：')
      if (!k || !k.trim()) return
      sync.setKey(k.trim())
    }
    doPull().then(() => sync.pushNow())
  }, [doPull])

  // ---- URL 实时同步（分享即同一视图） ----
  useEffect(() => {
    const qs = encodeFilters(filters)
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    window.history.replaceState(null, '', url)
  }, [filters])

  useEffect(() => {
    const onPop = () => setFilters(decodeFilters(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const patch = useCallback(p => setFilters(f => ({ ...f, ...p })), [])
  const resetAll = useCallback(() => { setFilters(defaultFilters()); setFavOnly(false); setLimit(PAGE_SIZE) }, [])

  const fireToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  // ---- 收藏 / 笔记（localStorage） ----
  const toggleFav = id => {
    setFavs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveFavs(next)
      return next
    })
  }
  const updateNote = (id, text) => {
    setNotes(prev => {
      const next = { ...prev }
      text.trim() ? (next[id] = text) : delete next[id]
      saveNotes(next)
      return next
    })
  }

  // ---- 对比栏（最多 3 个） ----
  const toggleCompare = id => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) { fireToast('最多同时对比 3 个城市，先移除一个吧'); return prev }
      return [...prev, id]
    })
  }

  const results = useMemo(
    () => sortCities(applyFilters(all, filters, { favs, favOnly }), filters.sort),
    [all, filters, favs, favOnly],
  )
  const uniMatched = results.filter(c => c.uni_town).length

  useEffect(() => { setLimit(PAGE_SIZE) }, [filters, favOnly])

  const detailCity = all.find(c => c.id === detailId) || null
  const compareCities = compareIds.map(id => all.find(c => c.id === id)).filter(Boolean)

  const shareLink = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      fireToast('链接已复制！朋友打开即为完全相同的筛选视图')
    } catch {
      prompt('复制此链接分享给朋友：', url)
    }
  }, [filters])

  const activeChips = useMemo(() => {
    const chips = []
    filters.provinces.forEach(p => chips.push({ k: `p:${p}`, label: p, clear: () => patch({ provinces: filters.provinces.filter(x => x !== p) }) }))
    filters.tags.forEach(t => chips.push({ k: `t:${t}`, label: t, clear: () => patch({ tags: filters.tags.filter(x => x !== t) }) }))
    filters.types.forEach(ty => chips.push({ k: `ty:${ty}`, label: { A: '一二线', B: '一线郊区', C: '二线郊区', D: '三四线', E: '县城/小镇' }[ty], clear: () => patch({ types: filters.types.filter(x => x !== ty) }) }))
    if (filters.cleanOnly) chips.push({ k: 'clean', label: '50km 无重污染', clear: () => patch({ cleanOnly: false }) })
    if (filters.budget) chips.push({ k: 'budget', label: `预算 ¥${budgetTotal(filters.budget)}/月（${filters.budget.mode === 'shared' ? '合租' : '整租'}）`, clear: () => patch({ budget: null }) })
    return chips
  }, [filters, patch])

  const filterPanel = (
    <FilterPanel
      filters={filters}
      patch={patch}
      regionTree={dataset.regions}
      resetAll={resetAll}
    />
  )

  // 筛选按钮上的已选条件计数（搜索词/排序不计）
  const activeFilterCount = useMemo(() => {
    let n = filters.provinces.length + filters.tags.length + filters.types.length
    if (filters.cleanOnly) n++
    if (filters.uniOnly) n++
    if (filters.levels.length !== DEFAULT_LEVELS.length || filters.levels.some(l => !DEFAULT_LEVELS.includes(l))) n++
    return n
  }, [filters])

  const toggleFilterOpen = () => {
    setFilterOpen(v => {
      const next = !v
      localStorage.setItem('cw:filterOpen', next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-paper">
                <MapPinned size={18} />
              </span>
              <div>
                <h1 className="text-[16px] font-bold leading-tight tracking-tight text-stone-900 sm:text-[17px]">
                  去哪躺平
                </h1>
                <p className="hidden text-[11px] text-stone-400 sm:block">
                  全国低成本旅居躺平指南 · {dataset.total} 个城市/区县/旅居小镇
                </p>
              </div>
            </div>

            <div className="order-3 w-full sm:order-none sm:ml-2 sm:w-auto sm:flex-1 sm:max-w-md">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={filters.q}
                  onChange={e => patch({ q: e.target.value })}
                  placeholder="搜城市 / 拼音 / 省份 / 县区 / 标签，如 腾冲、kunming、温泉"
                  className="w-full rounded-full border border-stone-200 bg-white py-2 pl-9 pr-8 text-[13px] text-stone-700 shadow-sm outline-none transition placeholder:text-stone-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                />
                {filters.q && (
                  <button onClick={() => patch({ q: '' })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setFavOnly(v => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition
                  ${favOnly ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                <Heart size={14} fill={favOnly ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">只看收藏</span>
              </button>
              <button
                onClick={onSyncClick}
                title={{
                  off: '云同步未开启（点击输入作者 key）',
                  syncing: '正在与云端同步…',
                  ok: '已与云端同步（点击重新同步）',
                  noauth: 'key 无效，点击重新输入',
                  error: '同步失败，点击重试',
                }[syncStatus]}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition
                  ${syncStatus === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    : syncStatus === 'syncing'
                      ? 'border-sky-200 bg-sky-50 text-sky-600'
                      : syncStatus === 'noauth' || syncStatus === 'error'
                        ? 'border-amber-300 bg-amber-50 text-amber-600'
                        : 'border-stone-200 bg-white text-stone-400 hover:border-stone-300 hover:text-stone-600'}`}
              >
                {syncStatus === 'syncing'
                  ? <RefreshCw size={15} className="animate-spin" />
                  : syncStatus === 'off'
                    ? <CloudOff size={15} />
                    : <Cloud size={15} />}
              </button>
              <button
                onClick={shareLink}
                className="flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-[12px] font-medium text-white shadow-sm transition hover:bg-stone-700"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">复制分享链接</span>
                <Link2 size={12} className="sm:hidden" />
              </button>
              <button
                onClick={() => setShowBudget(true)}
                title="按预算查找：房租/餐饮/杂费/交通/其他逐项设限，匹配住得起的城市"
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition
                  ${filters.budget
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                <Wallet size={14} />
                <span className="hidden sm:inline">按预算查找</span>
              </button>
              <button
                onClick={toggleFilterOpen}
                className={`hidden lg:flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-medium transition
                  ${filterOpen
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                <SlidersHorizontal size={14} />
                筛选
                {activeFilterCount > 0 && (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold
                    ${filterOpen ? 'bg-white/25 text-white' : 'bg-emerald-600 text-white'}`}>
                    {activeFilterCount}
                  </span>
                )}
                {filterOpen && <ChevronUp size={13} />}
              </button>
              <button
                onClick={() => setMobileFilter(true)}
                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-600 lg:hidden"
              >
                <SlidersHorizontal size={14} />筛选
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <StatBar
          total={dataset.total}
          matched={results.length}
          favCount={favs.size}
          compareCount={compareIds.length}
        />

        {/* 桌面端：顶部下拉横幅式筛选面板 */}
        {filterOpen && (
          <div className="animate-pop-in mt-5 hidden rounded-2xl border border-stone-200/70 bg-white/70 p-4 shadow-sm lg:block">
            <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                <SlidersHorizontal size={14} className="text-emerald-700" />
                筛选条件
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/15">
                    已选 {activeFilterCount} 项
                  </span>
                )}
              </span>
              <button
                onClick={toggleFilterOpen}
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-[12px] text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
              >
                收起<ChevronUp size={13} />
              </button>
            </div>
            <FilterPanel
              banner
              filters={filters}
              patch={patch}
              regionTree={dataset.regions}
              resetAll={resetAll}
            />
          </div>
        )}

        <div className="mt-5 flex gap-6">
          {/* 结果区 */}
          <section className="min-w-0 flex-1">
            {/* 工具条 */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                <Compass size={14} className="text-emerald-700" />
                <span><b className="text-stone-800">{results.length}</b> 个城市符合条件</span>
                {filters.uniOnly && (
                    <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-500 ring-1 ring-indigo-500/15">
                      <GraduationCap size={11} />仅看大学城
                    </span>
                  )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={filters.sort}
                  onChange={e => patch({ sort: e.target.value })}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 outline-none focus:border-emerald-500"
                >
                  {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <div className="flex rounded-full border border-stone-200 bg-white p-0.5">
                  <button
                    onClick={() => { setView('grid'); localStorage.setItem('cw:view', 'grid') }}
                    className={`flex h-7 w-8 items-center justify-center rounded-full transition ${view === 'grid' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}
                    title="卡片网格"
                  >
                    <LayoutGrid size={14} />
                  </button>
                  <button
                    onClick={() => { setView('list'); localStorage.setItem('cw:view', 'list') }}
                    className={`flex h-7 w-8 items-center justify-center rounded-full transition ${view === 'list' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}
                    title="紧凑列表"
                  >
                    <List size={14} />
                  </button>
                  <button
                    onClick={() => { setView('map'); localStorage.setItem('cw:view', 'map') }}
                    className={`flex h-7 w-8 items-center justify-center rounded-full transition ${view === 'map' ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-600'}`}
                    title="地图分布"
                  >
                    <MapIcon size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* 已选条件 chips */}
            {activeChips.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {activeChips.map(c => (
                  <button
                    key={c.k}
                    onClick={c.clear}
                    className="flex items-center gap-1 rounded-full bg-stone-800/90 py-1 pl-2.5 pr-1.5 text-[11px] text-white transition hover:bg-stone-700"
                  >
                    {c.label}<X size={11} className="opacity-70" />
                  </button>
                ))}
                <button onClick={resetAll} className="text-[11px] text-stone-400 underline-offset-2 hover:underline">
                  全部清除
                </button>
              </div>
            )}

            {/* 列表 */}
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/60 px-6 py-20 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <Search size={22} />
                </div>
                <p className="text-[14px] font-medium text-stone-600">没有符合全部条件的城市</p>
                <p className="mt-1 text-[12px] text-stone-400">
                  {filters.uniOnly ? '当前开启了「优先大学城」，关闭它可查看全国全部城市；' : ''}试着放宽房租档或减少标签
                </p>
                <button
                  onClick={resetAll}
                  className="mt-4 rounded-full bg-stone-900 px-5 py-2 text-[13px] font-medium text-white hover:bg-stone-700"
                >
                  重置筛选
                </button>
              </div>
            ) : view === 'map' ? (
              <MapView cities={results} onOpen={setDetailId} />
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {results.slice(0, limit).map(c => (
                  <CityCard
                    key={c.id}
                    city={c}
                    fav={favs.has(c.id)}
                    comparing={compareIds.includes(c.id)}
                    onToggleFav={() => toggleFav(c.id)}
                    onToggleCompare={() => toggleCompare(c.id)}
                    onOpen={setDetailId}
                    onShare={shareCtl.start}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.slice(0, limit).map(c => (
                  <CityRow
                    key={c.id}
                    city={c}
                    fav={favs.has(c.id)}
                    comparing={compareIds.includes(c.id)}
                    onToggleFav={() => toggleFav(c.id)}
                    onToggleCompare={() => toggleCompare(c.id)}
                    onOpen={setDetailId}
                    onShare={shareCtl.start}
                  />
                ))}
              </div>
            )}

            {view !== 'map' && results.length > limit && (
              <button
                onClick={() => setLimit(n => n + PAGE_SIZE)}
                className="mt-5 w-full rounded-2xl border border-dashed border-stone-300 bg-white/60 py-3 text-[13px] text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
              >
                加载更多（还有 {results.length - limit} 个）
              </button>
            )}

            {filters.uniOnly && results.length > 0 && (
              <p className="mt-4 text-center text-[11px] text-stone-400">
                仅展示 {uniMatched} 个大学城周边城市 · 打开筛选面板关闭该开关可浏览全国
              </p>
            )}
          </section>
        </div>
      </main>

      {/* 移动端筛选抽屉 */}
      {mobileFilter && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-stone-900/40" onClick={() => setMobileFilter(false)} />
          <div className="animate-pop-in absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-paper p-4 pb-8">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-stone-800">
                <SlidersHorizontal size={15} />筛选条件
              </span>
              <button onClick={() => setMobileFilter(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                <X size={16} />
              </button>
            </div>
            {filterPanel}
            <button
              onClick={() => setMobileFilter(false)}
              className="mt-4 w-full rounded-full bg-stone-900 py-3 text-[13px] font-medium text-white"
            >
              查看 {results.length} 个结果
            </button>
          </div>
        </div>
      )}

      {/* 对比浮动条 */}
      {compareIds.length > 0 && !showCompare && (
        <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="animate-pop-in flex items-center gap-2 rounded-2xl border border-stone-700 bg-stone-900/95 p-2 pl-4 text-white shadow-2xl backdrop-blur">
            <Scale size={16} className="flex-none text-amber-400" />
            <div className="min-w-0 flex-1 text-[12px]">
              {compareIds.length === 1 ? (
                <span className="text-stone-300">再选 1 个城市即可对比</span>
              ) : (
                <span className="truncate">
                  已选 {compareCities.map(c => c.name).join(' / ')}
                </span>
              )}
            </div>
            <button
              onClick={() => setCompareIds([])}
              className="rounded-full px-2 py-1.5 text-[11px] text-stone-400 hover:text-white"
            >
              清空
            </button>
            <button
              disabled={compareIds.length < 2}
              onClick={() => setShowCompare(true)}
              className="rounded-full bg-amber-400 px-4 py-1.5 text-[12px] font-semibold text-stone-900 transition enabled:hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              开始对比
            </button>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailCity && (
        <CityDetailModal
          city={detailCity}
          fav={favs.has(detailCity.id)}
          comparing={compareIds.includes(detailCity.id)}
          onClose={() => setDetailId(null)}
          onToggleFav={() => toggleFav(detailCity.id)}
          onToggleCompare={() => toggleCompare(detailCity.id)}
          note={notes[detailCity.id] || ''}
          onNoteChange={text => updateNote(detailCity.id, text)}
        />
      )}

      {/* 对比弹窗 */}
      {showCompare && (
        <CompareModal
          cities={compareCities}
          onClose={() => setShowCompare(false)}
          onRemove={id => setCompareIds(prev => prev.filter(x => x !== id))}
        />
      )}

      {/* 预算模式弹窗 */}
      {showBudget && (
        <BudgetModal
          initial={filters.budget}
          onClose={() => setShowBudget(false)}
          onApply={b => patch(b ? { budget: b, sort: 'total' } : { budget: null })}
          previewCount={b => applyFilters(all, { ...filters, budget: b }, { favs, favOnly }).length}
        />
      )}

      {/* 智能小助手 */}
      <Assistant
        cities={all}
        filters={filters}
        favs={favs}
        favOnly={favOnly}
        lifted={compareIds.length > 0 && !showCompare}
        onApplyFilters={setFilters}
        onSetFavOnly={setFavOnly}
        onReset={resetAll}
        onOpen={setDetailId}
      />

      {/* 卡片分享：离屏渲染 + PNG 预览层（portal 到 body） */}
      {shareCtl.node}

      {/* Toast */}
      {toast && (
        <div className="animate-toast-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900 px-5 py-2.5 text-[12.5px] text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
