import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  X, Heart, BedDouble, Home as HomeIcon, Wallet, MapPin, Droplets, UtensilsCrossed,
  Thermometer, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, NotebookPen, Check, Scale,
  GraduationCap, BusFront, ShoppingBasket, Wifi, Signal, Coffee, TrainFront, Plane, CarTaxiFront,
  Share2, Loader2, Cross, Award, Mountain, ShieldHalf, ChefHat, ChevronDown, ChevronUp, Wind, Landmark, Users, Briefcase, Info,
} from 'lucide-react'
import { TagChip, CleanBadge, yuan } from './CityCard.jsx'
import { TILE_URL, TILE_SUBDOMAINS, LEVEL_COLORS } from './MapView.jsx'
import { useCityShare } from './useCityShare.jsx'
import { nearestSpec, nearestSpecs, specDistanceText } from '../lib/store.js'
import { pm25Level, fiscalGrade } from '../lib/constants.js'
import dataset from '../data/cities_full.json'

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

// 地方名菜卡：展示全部名菜（县区条目继承自母城口味）
function FoodBlock({ city }) {
  if (!city.dishes?.length) return null
  return (
    <Block icon={<UtensilsCrossed size={14} className="text-orange-600" />} title="地方名菜与小吃">
      <div className="flex flex-wrap gap-1.5">
        {city.dishes.map(d => (
          <span key={d} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11.5px] text-orange-700 ring-1 ring-orange-500/15">
            {d}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-stone-400">
        收录地方公认名菜与代表性小吃；可在搜索框按菜名、菜系或口味关键词（如「火锅」「面食」「宫保鸡丁」「清淡」「重口」）筛选关联城市。
      </p>
    </Block>
  )
}

// 本地苍蝇馆子/市井名店卡：默认露前5家，可展开全部
function RestBlock({ city }) {
  const list = city.restaurants
  if (!list?.length) return null
  const [open, setOpen] = useState(false)
  const shown = open ? list : list.slice(0, 5)
  return (
    <Block icon={<ChefHat size={14} className="text-amber-600" />} title="本地苍蝇馆子 / 市井名店">
      <ul className="space-y-1.5">
        {shown.map((x, i) => (
          <li key={x.name} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">{i + 1}</span>
            <span className="leading-5">
              <span className="font-medium text-stone-700">{x.name}</span>
              {x.dish && <span className="ml-1 text-stone-500">· {x.dish}</span>}
            </span>
          </li>
        ))}
      </ul>
      {list.length > 5 && (
        <button onClick={() => setOpen(o => !o)} className="mt-2 flex items-center gap-0.5 text-[11.5px] text-amber-600 hover:text-amber-700">
          {open ? <><ChevronUp size={13} /> 收起</> : <><ChevronDown size={13} /> 展开全部 {list.length} 家</>}
        </button>
      )}
      <p className="mt-2 text-[11px] leading-4 text-stone-400">
        来源：大众点评必吃榜、高德烟火小店榜、本地公认老店。仅收录可验证的地道小店，县区继承母城名单。
      </p>
    </Block>
  )
}

// 治安与安全卡：边境标记 + 群众安全感等官方指标；无数据时说明全国基线
function SafetyBlock({ city }) {
  const s = city.safety
  return (
    <Block icon={<ShieldHalf size={14} className="text-emerald-600" />} title="治安与安全">
      <div className="space-y-1.5">
        {city.border && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-rose-600">
            <Mountain size={13} /> 陆地边境城市（公安部边境管理区名单）
          </p>
        )}
        {s ? (
          <>
            {typeof s.security === 'number' && (
              <p className="text-[13px] text-stone-700">
                群众安全感 <b className="text-emerald-700">{s.security}%</b>（{s.year} 年）
              </p>
            )}
            {typeof s.security === 'string' && (
              <p className="text-[13px] text-stone-700">
                群众安全感：<b className="text-emerald-700">{s.security}</b>（{s.year} 年）
              </p>
            )}
            {s.securityRank && (
              <p className="text-[13px] text-stone-700">
                城市治安体验 <b className="text-emerald-700">{s.securityRank}</b>（{s.year} 年）
              </p>
            )}
            {s.securityTrend && (
              <p className="text-[13px] text-stone-700">群众安全感{s.securityTrend}</p>
            )}
            {s.murderRate && (
              <p className="text-[13px] text-stone-700">万人命案发案数：<b className="text-stone-700">{s.murderRate}</b></p>
            )}
            {(s.note || s.source) && (
              <p className="text-[11px] text-stone-400">来源：{s.source || '各地政法委公开发布'}{s.note ? `｜${s.note}` : ''}</p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-stone-500">
            暂无该市公开的治安指标数据。
          </p>
        )}
        <p className="text-[11px] leading-4 text-stone-400">
          全国基线：2024 年中国每 10 万人命案发生数 0.44 起，是世界上命案发案率最低的国家之一。
          中国不公开城市级别犯罪率统计，本指标以各地政法委公开发布的「群众安全感」等官方数据为准，宁缺毋滥。
          搜索「不要边境小城」「治安好的地方」可筛选。
        </p>
      </div>
    </Block>
  )
}

// 三甲医院名单卡：默认显示 3 家，超出折叠为「展开全部 N 家」（行业惯例）
function MedBlock({ city }) {
  const [expanded, setExpanded] = useState(false)
  const med = city.med
  if (!med || (!med.n && !med.p)) return null
  const names = dataset.hospitals[med.k] || []
  const own = med.n > 0
  const count = own ? med.n : med.p
  const shown = expanded ? names : names.slice(0, 3)
  return (
    <Block icon={<Cross size={14} className="text-sky-600" />} title={own ? `三甲医院（本市 ${count} 家）` : `三甲医院（市区 ${med.k} · ${count} 家）`}>
      {!own && (
        <p className="mb-2 text-[12px] text-stone-400">本城暂无三甲，就近共享市区医疗资源：</p>
      )}
      <ul className="space-y-1.5">
        {shown.map(n => (
          <li key={n} className="flex items-start gap-1.5">
            <Cross size={12} className="mt-[6px] flex-none text-sky-400" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
      {names.length > 3 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-[12px] font-medium text-sky-700 transition hover:text-sky-900"
        >
          {expanded ? '收起' : `展开全部 ${names.length} 家`}
        </button>
      )}
    </Block>
  )
}

// 全国专科强院卡：本市拥有的复旦 2023 专科声誉榜 Top10 科室（按名次升序，带头人以小签标注）
// 本市无强院时退化为「就近就医参考」：有当前筛选专科时给该专科最近强院，否则给全部专科里最近的 3 家
function SpecBlock({ city, specKey }) {
  const specs = dataset.specialties?.specs || {}
  if (!city.spec?.length) {
    if (specKey && specs[specKey]) {
      const n = nearestSpec(city, specKey)
      if (!n) return null
      // 最近强院恰为指南带头人所在医院时重点标注
      const lead = (specs[specKey].list || []).find(h => h.leader && h.short === n.short)
      return (
        <Block icon={<Award size={14} className="text-amber-600" />} title={`${specs[specKey].name}强院就医参考`}>
          <p>
            本城暂无该专科全国 Top10 强院，最近的是
            <b className="mx-1 text-stone-700">{n.short}</b>
            （{n.city} · 全国第{n.rank}），直线距离约 <b className="text-stone-700">{Math.round(n.km)}</b> km。
          </p>
          {lead && (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900 ring-1 ring-amber-500/25">
              ★ <b>指南带头人</b>：{lead.leader.name}（{lead.leader.title || '学科带头人'}）在该院任学科带头人
            </p>
          )}
          <p className="mt-1 text-[12px] text-stone-400">{specDistanceText(n.km)}</p>
        </Block>
      )
    }
    const ns = nearestSpecs(city, 3)
    if (!ns.length) return null
    return (
      <Block icon={<Award size={14} className="text-amber-600" />} title="就近专科强院参考">
        <p className="mb-2 text-[12px] text-stone-400">本城暂无复旦榜全国 Top10 专科强院，就近可考虑：</p>
        <ul className="space-y-1.5">
          {ns.map(n => (
            <li key={n.key} className="flex items-start gap-1.5">
              <Award size={12} className="mt-[6px] flex-none text-amber-500" />
              <span>
                <b className="text-stone-700">{specs[n.key]?.name || n.key}</b>
                <span className="ml-1 text-stone-500">{n.short}（{n.city} · 全国第{n.rank}）</span>
                <span className="ml-1 rounded bg-amber-50 px-1 py-px text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/20">约 {Math.round(n.km)} km</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-4 text-stone-400">直线距离仅供参考，实际路程以高铁/航班为准。</p>
      </Block>
    )
  }
  // 按专科分组：同专科多家医院合并为一行
  const groups = []
  for (const [key, rank, short] of city.spec) {
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, rank, hosps: [] }; groups.push(g) }
    g.hosps.push({ rank, short })
    if (rank < g.rank) g.rank = rank
  }
  groups.sort((a, b) => a.rank - b.rank)
  // 默认折叠：>5 个科室时只显示前 5（按排名优先），点击展开全部
  const SPEC_FOLD = 5
  const [specOpen, setSpecOpen] = useState(false)
  const folded = groups.length > SPEC_FOLD && !specOpen
  const shown = folded ? groups.slice(0, SPEC_FOLD) : groups
  return (
    <Block icon={<Award size={14} className="text-amber-600" />} title={`全国专科强院（本市 ${groups.length} 个科室上榜）`}>
      <ul className="space-y-1.5">
        {shown.map(g => {
          const sd = specs[g.key]
          const leaders = (sd?.list || []).filter(h => h.leader && g.hosps.some(x => x.short === h.short))
          return (
            <li key={g.key} className="flex items-start gap-1.5">
              <Award size={12} className="mt-[6px] flex-none text-amber-500" />
              <span>
                <b className="text-stone-700">{sd?.name || g.key}</b>
                <span className="ml-1 rounded bg-amber-50 px-1 py-px text-[11px] font-medium text-amber-800 ring-1 ring-amber-500/20">全国第{g.rank}</span>
                <span className="ml-1 text-stone-500">{g.hosps.map(h => h.short).join('、')}</span>
                {leaders.map(h => (
                  <span key={h.short}
                    title={`${h.leader.title || '学科带头人'}｜权威诊疗指南牵头/核心专家`}
                    className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-px text-[11px] font-semibold text-amber-800 ring-1 ring-amber-400/50">
                    ★ 指南带头人 {h.leader.name}
                  </span>
                ))}
                {specKey === g.key && sd?.guides?.length > 0 && (
                  <span className="mt-1 block text-[12px] leading-5 text-stone-400">
                    参考指南：{sd.guides.map(x => `《${x}》`).join(' ')}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {groups.length > SPEC_FOLD && (
        <button
          onClick={() => setSpecOpen(v => !v)}
          className="mt-2 text-[12px] font-medium text-amber-700 hover:text-amber-800">
          {specOpen ? '收起' : `展开全部 ${groups.length} 个科室`}
        </button>
      )}
      <p className="mt-2 text-[11px] leading-4 text-stone-400">
        来源：{dataset.specialties?.source || '复旦版中国医院专科声誉排行榜'}。带头人为公开报道的学科带头人，指南为对应专科权威共识/诊疗指南，均仅供参考。
      </p>
    </Block>
  )
}

// owner 私密财政明细：参考性反推一般公共预算收支 + 地方政府债务总规模
//   仅 isOwner 渲染（有 owner key 且非访客链接），分享链接看不到
//   基于城市类型基础值 × score 系数估算收入，自给度反推支出，投资活跃度推债务
function OwnerFiscalDetail({ fiscal, type }) {
  const [show, setShow] = useState(false)
  if (!fiscal) return null
  // 一般公共预算收入基础值（亿元）：一二线 2000、一线郊区 500、二线郊区 350、三四线 200、县城 60
  const TYPE_BASE = { '一二线城市': 2000, '一线郊区': 500, '二线郊区': 350, '三四线城市': 200, '县城/小镇': 60 }
  const base = TYPE_BASE[type] || 80
  const sc = fiscal.score
  const ss = fiscal.self_sufficiency
  const ia = fiscal.invest_activity
  const revenue = Math.round(base * (0.5 + sc * 0.8) / 10) * 10
  const expenditure = Math.round(revenue / Math.max(0.3, ss) / 10) * 10
  const debt = Math.round(expenditure * (1.5 + (1 - ss) * 3) * ia / 10) * 10
  return (
    <div className="mt-1.5 rounded-lg bg-stone-100/80 px-2.5 py-1.5 ring-1 ring-stone-300/50">
      <button onClick={() => setShow(v => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700">
        <Info size={11} /> 财政明细（仅自己可见）
        {show ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {show && (
        <div className="mt-1.5 space-y-1 text-[11.5px] leading-5 text-stone-600">
          <div>一般公共预算收入：<b className="text-stone-800">{revenue}</b> 亿元（估算）</div>
          <div>一般公共预算支出：<b className="text-stone-800">{expenditure}</b> 亿元（收入 ÷ 自给度 {Math.round(ss * 100)}%）</div>
          <div>地方政府债务余额：<b className="text-stone-800">{debt}</b> 亿元（投资活跃度 × 缺口累积估算）</div>
          <div className="text-stone-400">收入支出差（赤字）：约 <b className="text-stone-500">{expenditure - revenue}</b> 亿元，自给率 {Math.round(ss * 100)}%</div>
          <p className="text-stone-400">以上为参考性估算，非真实决算数。建议结合财政部地方债务公开数据核对。</p>
        </div>
      )}
    </div>
  )
}

// 上市公司总部所在地卡：仅收录沪深300成分股 + 港股内地消费/科技/金融龙头
//   按板块分组（消费/科技/金融），公司名 + 代码 + 交易所标识
//   区县继承母城名单（股东大会在母城召开）
//   默认折叠（不显眼位置）— 用户展开查看
function ListedBlock({ city }) {
  const list = city.listed
  const [open, setOpen] = useState(false)
  if (!list?.length) return null
  const SECTOR_ORDER = ['消费', '科技', '金融']
  const SECTOR_CLS = {
    消费: 'bg-orange-50 text-orange-700 ring-orange-500/20',
    科技: 'bg-sky-50 text-sky-700 ring-sky-500/20',
    金融: 'bg-violet-50 text-violet-700 ring-violet-500/20',
  }
  const EX_LABEL = { SH: '沪', SZ: '深', HK: '港', US: '美' }
  // 按板块分组（保持插入顺序）
  const groups = SECTOR_ORDER
    .map(s => ({ s, items: list.filter(x => x.s === s) }))
    .filter(g => g.items.length)
  const total = list.length
  // 折叠时只显示前 6 家（按板块顺序），展开后显示全部
  const shown = open ? list : list.slice(0, 6)
  const shownGroups = SECTOR_ORDER
    .map(s => ({ s, items: shown.filter(x => x.s === s) }))
    .filter(g => g.items.length)
  return (
    <Block icon={<Briefcase size={14} className="text-stone-500" />} title={`上市公司总部所在地（${total} 家）`}>
      <div className="space-y-2.5">
        {shownGroups.map(g => (
          <div key={g.s}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-stone-400">
              <span className={`rounded px-1.5 py-0.5 font-medium ring-1 ${SECTOR_CLS[g.s]}`}>{g.s}</span>
              <span>板块 · {g.items.length} 家{!open && g.items.length > 0 ? `（仅显示前若干家，展开看全部）` : ''}</span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {g.items.map((x, i) => (
                <li key={`${x.c}-${i}`}
                  title={`${x.n} · ${x.ex === 'HK' ? '港股' : x.ex === 'US' ? '美股' : 'A股'} ${x.c}${x.i ? ' · ' + x.i : ''}`}
                  className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11.5px] ring-1 ring-stone-200/70"
                >
                  <span className="font-medium text-stone-700">{x.n}</span>
                  <span className="text-[10px] text-stone-400">{x.c}</span>
                  <span className="rounded bg-stone-100 px-1 text-[9.5px] font-medium text-stone-500">{EX_LABEL[x.ex] || x.ex}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {total > 6 && (
        <button onClick={() => setOpen(o => !o)} className="mt-2 flex items-center gap-0.5 text-[11.5px] text-stone-500 hover:text-stone-700">
          {open ? <><ChevronUp size={13} /> 收起</> : <><ChevronDown size={13} /> 展开全部 {total} 家</>}
        </button>
      )}
      <p className="mt-2 text-[10.5px] leading-4 text-stone-400">
        仅收录沪深300成分股与港股内地消费/科技/金融龙头，按公司总部/办公地归类；股东大会通常在此召开。区县条目继承母城名单。数据非全量，仅供职业投资人参会参考。
      </p>
    </Block>
  )
}

export default function CityDetailModal({ city, fav, comparing, specKey, isOwner, onClose, onToggleFav, onToggleCompare, note, onNoteChange }) {
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
            {city.climate}
          </Block>

          <Block
            icon={city.clean50
              ? <ShieldCheck size={14} className="text-emerald-600" />
              : <ShieldAlert size={14} className="text-rose-500" />}
            title="生态与污染说明"
            tone={city.clean50 ? 'green' : 'red'}
          >
            {city.pm25?.v && (() => {
              const lv = pm25Level(city.pm25.v)
              return (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200/70">
                  <Wind size={18} className="text-stone-400" />
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[20px] font-bold leading-none text-stone-800">{city.pm25.v}</span>
                      <span className="text-[11px] text-stone-400">μg/m³</span>
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${lv.cls}`}>{lv.label}</span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-stone-400">PM2.5 近 7 天平均 · 数据截至 {city.pm25.updated} · 每周自动更新</div>
                  </div>
                  <span className="ml-auto hidden max-w-[45%] text-[10px] leading-4 text-stone-400 sm:block">
                    分级阈值参照 GB3095-2012（优≤35 / 良≤75），数据源 Open-Meteo（Copernicus CAMS 大气监测）
                  </span>
                </div>
              )
            })()}
            {city.environment}
          </Block>

          {city.fiscal?.score && (() => {
            const g = fiscalGrade(city.fiscal.score)
            return (
              <Block
                icon={<Landmark size={14} className="text-stone-600" />}
                title="公共服务与财政稳健度"
              >
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-stone-200/70">
                  <Landmark size={18} className="text-stone-400" />
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[20px] font-bold leading-none text-stone-800">{g.key}</span>
                      <span className="text-[11px] text-stone-400">级</span>
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${g.cls}`}>{g.label}</span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-stone-400">
                      公共服务保障评级 · 数据截至 {city.fiscal.updated} · 年度更新
                    </div>
                  </div>
                  <span className="ml-auto hidden max-w-[45%] text-[10px] leading-4 text-stone-400 sm:block">
                    {g.desc}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-stone-50 px-2.5 py-2 ring-1 ring-stone-200/60">
                    <div className="text-[10px] text-stone-400">财政自给度</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-stone-800">
                      {Math.round(city.fiscal.self_sufficiency * 100)}<span className="ml-0.5 text-[10px] font-normal text-stone-400">%</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-stone-400">收入/支出比</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 px-2.5 py-2 ring-1 ring-stone-200/60">
                    <div className="text-[10px] text-stone-400">人均民生支出</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-stone-800">
                      {city.fiscal.per_capita_living}<span className="ml-0.5 text-[10px] font-normal text-stone-400">元/年</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-stone-400">社保+教育+医疗+住房</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 px-2.5 py-2 ring-1 ring-stone-200/60">
                    <div className="text-[10px] text-stone-400">基建投资活跃度</div>
                    <div className="mt-0.5 text-[15px] font-semibold text-stone-800">
                      {Math.round(city.fiscal.invest_activity * 100)}<span className="ml-0.5 text-[10px] font-normal text-stone-400">/100</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-stone-400">固定资产投资强度</div>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] leading-5 text-stone-400">
                  以上为基于公开财政决算规律的模型估算（{(city.fiscal.score * 100).toFixed(0)}/100 综合分），反映城市公共服务供给能力与基建投入水平的相对位次，不代表真实决算数；数据年度更新，仅供参考。
                </p>
                {isOwner && <OwnerFiscalDetail fiscal={city.fiscal} type={city.type} />}
              </Block>
            )
          })()}

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

          {/* 三甲医院名单（名单超 3 家自动折叠） */}
          <MedBlock city={city} />

          {/* 地方名菜与小吃 */}
          <FoodBlock city={city} />
          <RestBlock city={city} />

          {/* 治安与安全：边境标记 + 群众安全感官方指标 */}
          <SafetyBlock city={city} />

          {/* 当地习俗与注意事项（外地人可能不适应或需注意的） */}
          {city.customs && city.customs.length > 0 && (
            <Block
              icon={<Users size={14} className="text-rose-500" />}
              title="当地习俗与注意事项"
              tone="red"
            >
              <ul className="space-y-2">
                {city.customs.map((x, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${x.warn ? 'bg-rose-500' : 'bg-stone-400'}`} />
                    <div>
                      <span className="font-medium text-stone-800">{x.t}</span>
                      {x.warn && <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600 ring-1 ring-rose-500/20">需注意</span>}
                      <span className="ml-1.5 text-stone-600">{x.d}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[10.5px] leading-4 text-stone-400">
                以上为当地常见习俗与可能需适应的事项，仅为提醒参考，并非定论。
              </p>
            </Block>
          )}

          {/* 全国专科强院（复旦 2023 专科声誉榜 Top10；无强院城市显示就近参考） */}
          <SpecBlock city={city} specKey={specKey} />

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

          {/* 上市公司总部所在地（不显眼位置：备忘录之后） */}
          <ListedBlock city={city} />
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
