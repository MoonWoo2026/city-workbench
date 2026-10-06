import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  X, Heart, BedDouble, Home as HomeIcon, Wallet, MapPin, Droplets, UtensilsCrossed,
  Thermometer, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, NotebookPen, Check, Scale,
  GraduationCap, BusFront, ShoppingBasket, Wifi, Signal, Coffee, TrainFront, Plane, CarTaxiFront,
  Share2, Loader2,
} from 'lucide-react'
import { TagChip, CleanBadge, yuan } from './CityCard.jsx'
import { TILE_URL, TILE_SUBDOMAINS, LEVEL_COLORS } from './MapView.jsx'
import { useCityShare } from './useCityShare.jsx'

function MiniMap({ city }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!city.lng || !city.lat || !ref.current) return
    const map = L.map(ref.current, {
      center: [city.lat, city.lng],
      zoom: 8,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer(TILE_URL, { subdomains: TILE_SUBDOMAINS }).addTo(map)
    L.circleMarker([city.lat, city.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: LEVEL_COLORS[city.rent_level] || '#78716c',
      fillOpacity: 0.95,
    }).addTo(map)
    const t = setTimeout(() => map.invalidateSize(), 90)
    return () => { clearTimeout(t); map.remove() }
  }, [city.id])
  return (
    <div className="relative">
      <div ref={ref} className="relative z-0 h-[200px] w-full overflow-hidden rounded-xl ring-1 ring-stone-200/70" />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] text-stone-400 ring-1 ring-stone-200/60">高德地图</span>
    </div>
  )
}

function PriceBox({ icon, label, value, strong }) {
  return (
    <div className={`rounded-2xl p-3.5 ${strong ? 'bg-emerald-600 text-white' : 'bg-stone-50 ring-1 ring-stone-200/60'}`}>
      <div className={`flex items-center gap-1 text-[11px] ${strong ? 'text-emerald-100' : 'text-stone-400'}`}>
        {icon}{label}
      </div>
      <div className={`mt-1 text-[22px] font-bold tracking-tight ${strong ? 'text-white' : 'text-stone-800'}`}>
        {yuan(value)}
        <span className={`ml-0.5 text-[11px] font-normal ${strong ? 'text-emerald-100' : 'text-stone-400'}`}>/月</span>
      </div>
    </div>
  )
}

function Block({ icon, title, children, tone }) {
  const toneCls =
    tone === 'green' ? 'bg-emerald-50/70 ring-emerald-600/15'
    : tone === 'red' ? 'bg-rose-50/70 ring-rose-500/15'
    : 'bg-stone-50 ring-stone-200/60'
  return (
    <section className={`rounded-2xl p-4 ring-1 ${toneCls}`}>
      <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
        {icon}{title}
      </h4>
      <div className="text-[13px] leading-6 text-stone-600">{children}</div>
    </section>
  )
}

export default function CityDetailModal({ city, fav, comparing, onClose, onToggleFav, onToggleCompare, note, onNoteChange }) {
  const [draft, setDraft] = useState(note || '')
  const [savedTip, setSavedTip] = useState(false)
  const timer = useRef(null)
  // 分享卡片（生成二维码 → 离屏渲染 → PNG 预览），逻辑在 useCityShare
  const shareCtl = useCityShare()

  useEffect(() => { setDraft(note || ''); setSavedTip(false); shareCtl.close() }, [city.id, note])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleNote = v => {
    setDraft(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onNoteChange(v)
      setSavedTip(true)
      setTimeout(() => setSavedTip(false), 1600)
    }, 400)
  }

  if (!city) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-stone-900/45 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-pop-in relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl">
        {/* 头部 */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200/70 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-bold tracking-tight text-stone-900">{city.name}</h2>
              <span className="text-[12px] text-stone-400">{city.pinyin}</span>
              <CleanBadge clean={city.clean50} />
            </div>
            <div className="mt-1 text-[12px] text-stone-400">
              {city.province} · {city.region} · {city.parent || city.type}
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              onClick={() => shareCtl.start(city)}
              title="生成分享卡片图（可转发到微信）"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 transition hover:bg-emerald-100"
            >
              {shareCtl.loading ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <PriceBox icon={<BedDouble size={12} />} label="典型主卧合租" value={city.rent_shared} />
            <PriceBox icon={<HomeIcon size={12} />} label="典型单人整租" value={city.rent_single} />
            <PriceBox icon={<Wallet size={12} />} label="预估月总支出（含生活）" value={city.monthly_total} strong />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {city.tags.map(t => <TagChip key={t} tag={t} />)}
          </div>

          {city.lng && city.lat && (
            <section className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/60">
              <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                <MapPin size={14} className="text-emerald-700" />
                地理位置
                <span className="ml-1 text-[11px] font-normal text-stone-400">
                  {city.province}{city.parent && city.parent !== city.province ? ` · ${city.parent}` : ''}
                </span>
              </h4>
              <MiniMap city={city} />
            </section>
          )}

          {city.uni_town && (
            <section className="rounded-2xl bg-indigo-50/80 p-4 ring-1 ring-indigo-500/20">
              <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-indigo-900">
                <GraduationCap size={14} className="text-indigo-600" />
                大学城周边住宿建议（个人优先项）
              </h4>
              <ul className="mb-2.5 space-y-1.5">
                {city.uni_town.areas.map((a, i) => (
                  <li key={a} className="flex items-start gap-2 text-[13px] leading-6 text-stone-700">
                    <MapPin size={13} className="mt-[7px] flex-none text-indigo-400" />
                    <span>{a}</span>
                    {i === 0 && <span className="ml-auto flex-none rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-indigo-500">房源最集中</span>}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-orange-600">
                    <UtensilsCrossed size={11} />吃 · 餐饮
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-stone-600">{city.uni_town.food}</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-sky-600">
                    <BusFront size={11} />行 · 交通
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-stone-600">{city.uni_town.transit}</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <ShoppingBasket size={11} />买 · 买菜
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-stone-600">{city.uni_town.grocery}</p>
                </div>
              </div>
            </section>
          )}

          <Block icon={<Thermometer size={14} className="text-teal-600" />} title="气候特征">
            {city.climate_stats && (
              <div className="mb-2.5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200/70">
                  <div className="flex items-center gap-1 text-[10px] text-sky-600"><Thermometer size={10} />最冷月</div>
                  <div className="mt-0.5 text-[15px] font-bold text-stone-800">{city.climate_stats.coldest.temp}°C</div>
                  <div className="text-[10px] text-stone-400">{city.climate_stats.coldest.month}月</div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200/70">
                  <div className="flex items-center gap-1 text-[10px] text-amber-600"><Thermometer size={10} />最热月</div>
                  <div className="mt-0.5 text-[15px] font-bold text-stone-800">{city.climate_stats.hottest.temp}°C</div>
                  <div className="text-[10px] text-stone-400">{city.climate_stats.hottest.month}月</div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200/70">
                  <div className="flex items-center gap-1 text-[10px] text-teal-600"><Droplets size={10} />年降水</div>
                  <div className="mt-0.5 text-[15px] font-bold text-stone-800">{city.climate_stats.annual_precip}mm</div>
                  <div className="text-[10px] text-stone-400">2021–2025 均值</div>
                </div>
              </div>
            )}
            {city.climate}
          </Block>

          <Block
            icon={city.clean50
              ? <ShieldCheck size={14} className="text-emerald-600" />
              : <ShieldAlert size={14} className="text-rose-500" />}
            title="生态与污染说明"
            tone={city.clean50 ? 'green' : 'red'}
          >
            {city.environment}
          </Block>

          <Block icon={<MapPin size={14} className="text-emerald-700" />} title="推荐租房区域">
            <ul className="space-y-1.5">
              {city.areas.map((a, i) => (
                <li key={a} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>{a}</span>
                  {i === 0 && <span className="ml-auto flex-none text-[11px] text-stone-400">生活最便利</span>}
                </li>
              ))}
            </ul>
          </Block>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Block icon={<Droplets size={14} className="text-sky-600" />} title="水 / 电 / 燃气 / 取暖">
              {city.utilities}
            </Block>
            <Block icon={<UtensilsCrossed size={14} className="text-orange-600" />} title="餐饮与物价参考">
              {city.food}
            </Block>
          </div>

          {city.net && city.transit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Block icon={<Wifi size={14} className="text-indigo-600" />} title="网速与远程办公">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <Signal size={13} className="mt-[5px] flex-none text-indigo-400" />
                    <p><span className="mr-1 font-medium text-stone-700">宽带 / 5G：</span>{city.net.broadband}</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <Coffee size={13} className="mt-[5px] flex-none text-amber-600" />
                    <p><span className="mr-1 font-medium text-stone-700">自习 / 办公：</span>{city.net.cowork}</p>
                  </li>
                </ul>
              </Block>
              <Block icon={<TrainFront size={14} className="text-sky-700" />} title="公共交通与出行成本">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CarTaxiFront size={13} className="mt-[5px] flex-none text-teal-600" />
                    <p><span className="mr-1 font-medium text-stone-700">打车 / 电驴：</span>{city.transit.taxi}</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrainFront size={13} className="mt-[5px] flex-none text-sky-600" />
                    <p><span className="mr-1 font-medium text-stone-700">高铁辐射：</span>{city.transit.rail}</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <Plane size={13} className="mt-[5px] flex-none text-violet-500" />
                    <p><span className="mr-1 font-medium text-stone-700">机场辐射：</span>{city.transit.air}</p>
                  </li>
                </ul>
              </Block>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Block icon={<CheckCircle2 size={14} className="text-emerald-600" />} title="优势" tone="green">
              <ul className="space-y-1">
                {city.pros.map(p => (
                  <li key={p} className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="mt-1 flex-none text-emerald-500" />{p}
                  </li>
                ))}
              </ul>
            </Block>
            <Block icon={<XCircle size={14} className="text-rose-400" />} title="劣势 / 踩雷点" tone="red">
              <ul className="space-y-1">
                {city.cons.map(p => (
                  <li key={p} className="flex items-start gap-1.5">
                    <XCircle size={14} className="mt-1 flex-none text-rose-400" />{p}
                  </li>
                ))}
              </ul>
            </Block>
          </div>

          {/* 个人备忘录 */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200/70">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                <NotebookPen size={14} className="text-amber-600" />
                个人备忘录
              </h4>
              <span className={`flex items-center gap-1 text-[11px] transition ${savedTip ? 'text-emerald-600' : 'text-stone-300'}`}>
                <Check size={11} />{savedTip ? '已自动保存' : '自动保存到本机'}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={e => handleNote(e.target.value)}
              rows={4}
              placeholder="记录你的实地考察、认识的房东、砍价心得、下次再来的时间……（仅保存在本浏览器）"
              className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5 text-[13px] leading-6 text-stone-700 outline-none transition placeholder:text-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </section>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-2.5 border-t border-stone-200/70 bg-white px-5 py-3">
          <button
            onClick={onToggleFav}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition
              ${fav ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
            {fav ? '已收藏' : '收藏 / 想去'}
          </button>
          <button
            onClick={onToggleCompare}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition
              ${comparing
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            <Scale size={15} />
            {comparing ? '已在对比栏' : '加入对比'}
          </button>
          <button
            onClick={onClose}
            className="ml-auto rounded-full bg-stone-800 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-stone-900"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 分享卡片离屏渲染 + PNG 预览层（portal 到 body） */}
      {shareCtl.node}
    </div>
  )
}
