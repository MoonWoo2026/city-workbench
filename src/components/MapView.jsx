import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown, ChevronUp } from 'lucide-react'

// 高德栅格瓦片（GCJ-02，与数据坐标同坐标系）
export const TILE_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
export const TILE_SUBDOMAINS = ['1', '2', '3', '4']

// 月整租五档配色（与数据 rent_level 对应）
export const LEVEL_COLORS = {
  under_1000: '#059669',
  '1000_1700': '#0d9488',
  '1700_3000': '#d97706',
  '3000_5000': '#ea580c',
  above_5000: '#dc2626',
}
export const SINGLE_BANDS = [
  { key: 'under_1000', label: '¥1000 以下' },
  { key: '1000_1700', label: '¥1000 – 1700' },
  { key: '1700_3000', label: '¥1700 – 3000' },
  { key: '3000_5000', label: '¥3000 – 5000' },
  { key: 'above_5000', label: '¥5000 以上' },
]

// 月合租五档（库内合租价中位数约 500 元，按实际分布切档；色阶与整租一致）
export const SHARED_BANDS = [
  { key: 'under_500', label: '¥500 以下', min: 0, max: 500 },
  { key: '500_700', label: '¥500 – 700', min: 500, max: 700 },
  { key: '700_1000', label: '¥700 – 1000', min: 700, max: 1000 },
  { key: '1000_1500', label: '¥1000 – 1500', min: 1000, max: 1500 },
  { key: 'above_1500', label: '¥1500 以上', min: 1500, max: Infinity },
]
const BAND_COLORS = ['#059669', '#0d9488', '#d97706', '#ea580c', '#dc2626']
SINGLE_BANDS.forEach((b, i) => { b.color = LEVEL_COLORS[b.key] })
SHARED_BANDS.forEach((b, i) => { b.color = BAND_COLORS[i] })

export const sharedLevelOf = v => (SHARED_BANDS.find(b => v >= b.min && v < b.max) || SHARED_BANDS[4]).key

function loadSel(key, defs) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const valid = new Set(defs.map(b => b.key))
      const arr = JSON.parse(raw).filter(k => valid.has(k))
      return new Set(arr)
    }
  } catch { /* noop */ }
  return new Set(defs.map(b => b.key))
}

export default function MapView({ cities, onOpen, heightClass = 'h-[68vh]' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const prevCitiesRef = useRef(null) // null = 首次绘制时自动 fitBounds 到当前结果

  const [priceMode, setPriceMode] = useState(() => (localStorage.getItem('cw:mapPriceMode') === 'shared' ? 'shared' : 'single'))
  const [singleSel, setSingleSel] = useState(() => loadSel('cw:mapSingleSel', SINGLE_BANDS))
  const [sharedSel, setSharedSel] = useState(() => loadSel('cw:mapSharedSel', SHARED_BANDS))
  const [dimmed, setDimmed] = useState(false) // 拖拽/缩放地图时图例变半透明
  const [collapsed, setCollapsed] = useState(false) // 手动收起为小胶囊

  const bands = priceMode === 'single' ? SINGLE_BANDS : SHARED_BANDS
  const sel = priceMode === 'single' ? singleSel : sharedSel

  // 每城 → 档位 + 颜色
  const marked = useMemo(() => cities.filter(c => c.lng && c.lat).map(c => {
    const lk = priceMode === 'single' ? c.rent_level : sharedLevelOf(c.rent_shared)
    return { c, lk }
  }), [cities, priceMode])

  const counts = useMemo(() => {
    const m = Object.fromEntries(bands.map(b => [b.key, 0]))
    for (const x of marked) if (m[x.lk] != null) m[x.lk]++
    return m
  }, [marked, bands])

  const shownCount = useMemo(() => marked.reduce((n, x) => n + (sel.has(x.lk) ? 1 : 0), 0), [marked, sel])

  // 初始化地图（仅一次）
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [35.5, 108],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer(TILE_URL, {
      subdomains: TILE_SUBDOMAINS,
      attribution: '&copy; 高德地图',
    }).addTo(map)
    // 地图交互期间图例半透明，停下即恢复
    const onStart = () => setDimmed(true)
    const onEnd = () => setDimmed(false)
    map.on('movestart', onStart)
    map.on('zoomstart', onStart)
    map.on('moveend', onEnd)
    map.on('zoomend', onEnd)
    mapRef.current = map
    window.__leafletMap = map // 调试/走查钩子
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // 数据/模式/勾选变化时重绘（rAF 延迟一帧：避免 StrictMode/快速卸载时 map.remove 与 Canvas 重绘竞态）
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    const raf = requestAnimationFrame(() => {
      if (cancelled || !mapRef.current) return
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      const pts = marked.filter(x => sel.has(x.lk))
      if (!pts.length) return
      const colorOf = lk => (bands.find(b => b.key === lk) || {}).color || '#78716c'
      const renderer = L.canvas({ padding: 0.4 })
      const group = L.layerGroup()
      for (const { c, lk } of pts) {
        const m = L.circleMarker([c.lat, c.lng], {
          renderer,
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: colorOf(lk),
          fillOpacity: 0.92,
        })
        const priceTxt = priceMode === 'single'
          ? `整租 ¥${c.rent_single}/月（合租 ¥${c.rent_shared}）`
          : `主卧合租 ¥${c.rent_shared}/月（整租 ¥${c.rent_single}）`
        m.bindTooltip(`${c.name} · ${priceTxt}`, { direction: 'top', offset: [0, -6] })
        m.on('click', () => onOpen && onOpen(c.id))
        group.addLayer(m)
      }
      group.addTo(map)
      layerRef.current = group
      // 仅在结果集本身变化时自适应视野；勾选价位只做显隐，不跳动视野
      const citiesChanged = prevCitiesRef.current !== cities
      prevCitiesRef.current = cities
      map.invalidateSize()
      if (citiesChanged) {
        map.fitBounds(L.latLngBounds(marked.map(x => [x.c.lat, x.c.lng])).pad(0.08))
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (layerRef.current && mapRef.current) {
        mapRef.current.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [marked, sel, bands, priceMode, cities, onOpen])

  // 视图切换回来后容器尺寸变化，需重算
  useEffect(() => {
    const t = setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [cities])

  const toggle = key => {
    const setter = priceMode === 'single' ? setSingleSel : setSharedSel
    setter(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(priceMode === 'single' ? 'cw:mapSingleSel' : 'cw:mapSharedSel', JSON.stringify([...next]))
      return next
    })
  }
  const allSelected = sel.size === bands.length
  const selectAll = on => {
    const next = new Set(on ? bands.map(b => b.key) : [])
    const setter = priceMode === 'single' ? setSingleSel : setSharedSel
    setter(next)
    localStorage.setItem(priceMode === 'single' ? 'cw:mapSingleSel' : 'cw:mapSharedSel', JSON.stringify([...next]))
  }
  const switchMode = m => {
    setPriceMode(m)
    localStorage.setItem('cw:mapPriceMode', m)
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`relative z-0 ${heightClass} w-full overflow-hidden rounded-2xl border border-stone-200/70 shadow-sm`}
      />
      {/* 价位图例（漂浮在地图上；拖拽/缩放时自动半透明，可手动收起） */}
      <div className={`absolute bottom-4 left-3 z-[500] select-none transition-opacity duration-200 ${dimmed ? 'pointer-events-none opacity-20' : 'opacity-100'}`}>
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] text-stone-600 shadow-md ring-1 ring-stone-200/70 backdrop-blur transition hover:bg-white"
            title="展开价位筛选"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: 'linear-gradient(135deg,#059669 0%,#059669 40%,#d97706 60%,#dc2626 100%)' }}
            />
            {priceMode === 'single' ? '月整租' : '月合租'} · 显示 {shownCount}
            <ChevronUp size={12} className="text-stone-400" />
          </button>
        ) : (
          <div className="w-[196px] rounded-xl bg-white/95 px-3 py-2.5 text-[11px] leading-5 text-stone-600 shadow-md ring-1 ring-stone-200/70 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-stone-500">价位筛选</span>
              <button
                onClick={() => setCollapsed(true)}
                className="rounded p-0.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                title="收起图例"
              >
                <ChevronDown size={13} />
              </button>
            </div>
            {/* 整租 / 合租 切换 */}
            <div className="mb-1.5 flex rounded-lg bg-stone-100 p-0.5 text-[11px] font-medium">
              {[['single', '月整租'], ['shared', '月合租']].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => switchMode(k)}
                  className={`flex-1 rounded-md py-1 transition ${priceMode === k ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-0.5">
              {bands.map(b => {
                const on = sel.has(b.key)
                return (
                  <button
                    key={b.key}
                    onClick={() => toggle(b.key)}
                    className={`flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-stone-100 ${on ? '' : 'opacity-45'}`}
                    title={on ? '点击隐藏该价位' : '点击只看该价位'}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-none rounded-full ring-1 ring-white"
                      style={{ background: on ? b.color : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${b.color}` }}
                    />
                    <span className={on ? 'text-stone-700' : 'text-stone-400 line-through decoration-stone-300'}>{b.label}</span>
                    <span className="ml-auto text-[10px] text-stone-400">{counts[b.key] ?? 0}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-stone-200/70 pt-1 text-stone-400">
              <span>显示 <b className={shownCount ? 'text-emerald-700' : 'text-rose-500'}>{shownCount}</b> / {marked.length}</span>
              <button onClick={() => selectAll(!allSelected)} className="text-[10.5px] text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline">
                {allSelected ? '全不选' : '全选'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
