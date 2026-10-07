import { Heart, ShieldCheck, ShieldAlert, Flame, ChevronRight, Check, GraduationCap, Share2, Thermometer, Droplets, Cross, Award, UtensilsCrossed, Mountain, ShieldHalf, ChefHat } from 'lucide-react'
import dataset from '../data/cities_full.json'
import { CLIMATE_TAGS } from '../lib/constants.js'
import ProvinceArt from './ProvinceArt.jsx'

export const TAG_ICON = Object.fromEntries(CLIMATE_TAGS.map(t => [t.key, t.icon]))

export function TagChip({ tag, size = 'sm' }) {
  const cls = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-0.5 text-[11px]'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-600/10 ${cls}`}>
      <span>{TAG_ICON[tag] ?? '·'}</span>
      {tag}
    </span>
  )
}

export function CleanBadge({ clean, size = 'sm' }) {
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return clean ? (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 font-medium text-emerald-700 ring-1 ring-emerald-600/15 ${cls}`}>
      <ShieldCheck size={size === 'xs' ? 10 : 11} />
      50km 无重污染
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full bg-rose-50 font-medium text-rose-600 ring-1 ring-rose-500/15 ${cls}`}>
      <ShieldAlert size={size === 'xs' ? 10 : 11} />
      周边有工业
    </span>
  )
}

export function UniBadge({ uni, size = 'sm' }) {
  if (!uni) return null
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return (
    <span
      title={uni.areas[0]}
      className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 font-medium text-indigo-700 ring-1 ring-indigo-500/15 ${cls}`}
    >
      <GraduationCap size={size === 'xs' ? 10 : 11} />
      大学城周边
    </span>
  )
}

// 三甲医院徽标：本市有 → 「三甲 N 家」（绿）；只有母城有 → 「市区三甲 N 家」（灰绿）
export function MedBadge({ med, size = 'sm' }) {
  if (!med || (!med.n && !med.p)) return null
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  const own = med.n > 0
  return (
    <span
      title={own ? `本市有 ${med.n} 家三甲医院` : `市区（${med.k}）有 ${med.p} 家三甲医院`}
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ${cls}
        ${own ? 'bg-sky-50 text-sky-700 ring-sky-600/15' : 'bg-stone-50 text-stone-500 ring-stone-400/15'}`}
    >
      <Cross size={size === 'xs' ? 10 : 11} />
      {own ? `三甲 ${med.n} 家` : `市区三甲 ${med.p} 家`}
    </span>
  )
}

// 三甲医院名单陈列：露前 2 家 + 多余折叠（title 悬停看全名单）
// 本市有三甲用蓝色，仅母城有（共享市区资源）用灰色
export function MedList({ city, size = 'sm' }) {
  if (!city.med) return null
  const names = dataset.hospitals[city.med.k] || []
  if (!names.length) return null
  const own = city.med.n > 0
  const shown = names.slice(0, 2)
  const cls = size === 'xs'
    ? 'mt-1 flex items-center gap-1 truncate text-[10.5px] text-sky-600/90'
    : 'mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50/60 px-2.5 py-1.5 text-[11px] leading-4 text-sky-700/90 ring-1 ring-sky-500/10'
  if (size === 'xs') {
    return (
      <div title={`三甲医院：${names.join('、')}`} className={`${cls} ${own ? '' : 'text-stone-400'}`}>
        <Cross size={10} className="flex-none" />
        <span className="truncate">
          {shown.join(' · ')}
          {names.length > 2 ? ` +${names.length - 2}` : ''}
        </span>
      </div>
    )
  }
  return (
    <div
      title={`三甲医院（${own ? '本市' : '共享 ' + city.med.k + ' 市区'}）：${names.join('、')}`}
      className={`${cls} ${own ? '' : 'bg-stone-50/60 text-stone-500 ring-stone-300/20'}`}
    >
      <Cross size={12} className="mt-0.5 flex-none" />
      <span className="line-clamp-1">
        {shown.join(' · ')}
        {names.length > 2 && <span className={own ? 'text-sky-400' : 'text-stone-400'}> +{names.length - 2}</span>}
      </span>
    </div>
  )
}

// 本地苍蝇馆子/市井名店陈列：露前 3 家（店名+招牌菜），多余折叠（title 悬停看全名单）
export function RestList({ city, size = 'sm' }) {
  const list = city.restaurants
  if (!list?.length) return null
  const shown = list.slice(0, 3)
  const full = list.map(x => x.dish ? `${x.name}（${x.dish}）` : x.name).join('、')
  if (size === 'xs') {
    return (
      <div title={`市井名店：${full}`} className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-amber-700/90">
        <ChefHat size={10} className="flex-none" />
        <span className="truncate">
          {shown.map(x => x.name).join(' · ')}
          {list.length > 3 ? ` +${list.length - 3}` : ''}
        </span>
      </div>
    )
  }
  return (
    <div
      title={`本地苍蝇馆子/市井名店：${full}`}
      className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800/90 ring-1 ring-amber-500/10"
    >
      <ChefHat size={12} className="mt-0.5 flex-none" />
      <span className="line-clamp-2">
        {shown.map((x, i) => (
          <span key={x.name}>
            {i > 0 && <span className="mx-0.5 text-amber-400">·</span>}
            <span>{x.name}</span>
            {x.dish && <span className="text-amber-600/70">（{x.dish}）</span>}
          </span>
        ))}
        {list.length > 3 && <span className="ml-0.5 text-amber-500">+{list.length - 3}</span>}
      </span>
    </div>
  )
}

// 专科强院徽标：仅当专科筛选激活且本市有该专科全国 Top10 强院时显示
// 命中医院若为权威指南牵头/带头人所在医院 → 金底★重点标注（悬停看带头人头衔）
export function SpecBadge({ city, specKey, size = 'sm' }) {
  if (!specKey || !city.spec) return null
  const es = city.spec.filter(s => s[0] === specKey)
  if (!es.length) return null
  const best = es.reduce((a, b) => (a[1] <= b[1] ? a : b))
  const sd = dataset.specialties?.specs?.[specKey]
  const lead = (sd?.list || []).find(h => h.leader && h.short === best[2])
  const specName = sd?.name || ''
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return (
    <span
      title={lead
        ? `${specName}（复旦 2023 专科声誉榜）：${best[2]} 全国第${best[1]}｜学科带头人 ${lead.leader.name}（${lead.leader.title || '学科带头人'}），牵头/参与权威诊疗指南`
        : `${specName}（复旦 2023 专科声誉榜）：${es.map(e => `${e[2]} 全国第${e[1]}`).join('、')}`}
      className={`inline-flex items-center gap-1 rounded-full ring-1 ${cls} ${
        lead ? 'bg-amber-200/70 font-semibold text-amber-900 ring-amber-500/50' : 'bg-amber-50 font-medium text-amber-800 ring-amber-500/25'
      }`}
    >
      <Award size={size === 'xs' ? 10 : 11} />
      {specName}全国第{best[1]} · {best[2]}
      {lead && <span className="text-amber-700">★带头人 {lead.leader.name}</span>}
    </span>
  )
}

// 边境城市徽标：陆地边境县/市（公安部公边[1999]4号名单）
export function BorderBadge({ city, size = 'sm' }) {
  if (!city.border) return null
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return (
    <span
      title="陆地边境城市（公安部边境管理区名单）"
      className={`inline-flex items-center gap-1 rounded-full bg-rose-50 font-medium text-rose-600 ring-1 ring-rose-500/20 ${cls}`}
    >
      <Mountain size={size === 'xs' ? 10 : 11} />
      边境
    </span>
  )
}

// 安全指标徽标：群众安全感等官方指标；无数据时不显示
export function SafetyBadge({ city, size = 'sm' }) {
  if (!city.safety) return null
  const s = city.safety
  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  let label = ''
  if (typeof s.security === 'number') label = `安全感 ${s.security}%`
  else if (typeof s.security === 'string') label = s.security // 省级定性描述，如「连续5年全国前三」
  else if (s.securityRank) label = `治安${s.securityRank}`
  else if (s.securityTrend) label = '安全感连年上升'
  else if (s.murderRate) label = `命案${s.murderRate}`
  if (!label) return null
  return (
    <span
      title={`来源：${s.source || '各地政法委公开发布'}${s.note ? '｜' + s.note : ''}`}
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 font-medium text-emerald-700 ring-1 ring-emerald-500/20 ${cls}`}
    >
      <ShieldHalf size={size === 'xs' ? 10 : 11} />
      {label}
    </span>
  )
}

export const yuan = n => `¥${Number(n).toLocaleString('zh-CN')}`

function FavButton({ fav, onToggle }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      aria-label={fav ? '取消收藏' : '收藏 / 想去'}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition
        ${fav ? 'bg-rose-50 text-rose-500' : 'text-stone-300 hover:bg-stone-100 hover:text-rose-400'}`}
    >
      <Heart size={17} fill={fav ? 'currentColor' : 'none'} />
    </button>
  )
}

function CompareToggle({ comparing, onToggle }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition
        ${comparing
          ? 'border-amber-500/60 bg-amber-50 text-amber-700'
          : 'border-stone-200 text-stone-500 hover:border-amber-400/60 hover:text-amber-600'}`}
    >
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-[5px] border
        ${comparing ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-300'}`}>
        {comparing && <Check size={9} strokeWidth={3.4} />}
      </span>
      {comparing ? '已加入对比' : '加入对比'}
    </button>
  )
}

function MetaLine({ city }) {
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
      <span>{city.province}</span>
      <span>·</span>
      <span className="truncate">{city.parent || city.region}</span>
      <span>·</span>
      <span className="truncate">{city.type}</span>
    </div>
  )
}

// ---------- 网格卡片 ----------
export function CityCard({ city, fav, comparing, specKey, onToggleFav, onToggleCompare, onOpen, onShare }) {
  return (
    <article
      onClick={() => onOpen(city.id)}
      className="card-lift group relative flex cursor-pointer flex-col rounded-3xl border border-stone-200/60 bg-white p-5 shadow-sm"
    >
      <ProvinceArt province={city.province} size={92} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[19px] font-semibold tracking-tight text-stone-800">
            <span className="font-display truncate">{city.name}</span>
            {city.hot && (
              <span title="旅居热门" className="flex-none text-amber-500">
                <Flame size={14} fill="currentColor" />
              </span>
            )}
          </h3>
          <MetaLine city={city} />
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); onShare(city) }}
            aria-label="生成分享图片"
            title="生成分享图片（可转发微信）"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-emerald-600"
          >
            <Share2 size={15} />
          </button>
          <FavButton fav={fav} onToggle={onToggleFav} />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <CleanBadge clean={city.clean50} />
        <UniBadge uni={city.uni_town} />
        <MedBadge med={city.med} />
        <SpecBadge city={city} specKey={specKey} />
        <BorderBadge city={city} />
        <SafetyBadge city={city} />
        {city.tags.slice(0, 3).map(t => <TagChip key={t} tag={t} />)}
        {city.tags.length > 3 && <span className="text-[10px] text-stone-400">+{city.tags.length - 3}</span>}
      </div>

      <MedList city={city} />

      <RestList city={city} />

      {city.uni_town && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-indigo-50/60 px-2.5 py-1.5 text-[11px] leading-4 text-indigo-700/90 ring-1 ring-indigo-500/10">
          <GraduationCap size={12} className="mt-0.5 flex-none" />
          <span className="line-clamp-1">{city.uni_town.areas[0]}</span>
        </div>
      )}

      {city.dishes?.length > 0 && (
        <div
          title={`地方名菜：${city.dishes.join('、')}`}
          className="mt-2 flex items-start gap-1.5 rounded-lg bg-orange-50/60 px-2.5 py-1.5 text-[11px] leading-4 text-orange-700/90 ring-1 ring-orange-500/10"
        >
          <UtensilsCrossed size={12} className="mt-0.5 flex-none" />
          <span className="line-clamp-1">
            {city.dishes.slice(0, 3).join(' · ')}
            {city.dishes.length > 3 && <span className="text-orange-400"> +{city.dishes.length - 3}</span>}
          </span>
        </div>
      )}

      {/* 价格：月总支出作主视觉，租金明细退为小字 */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-stone-400">每月全部开销约</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-[27px] font-bold leading-none tracking-tight text-emerald-800">
              {yuan(city.monthly_total)}
            </span>
            <span className="text-[11px] text-stone-400">/月</span>
          </div>
        </div>
        <div className="text-right text-[11.5px] leading-5 text-stone-400">
          <div>整租 <span className="font-medium text-stone-600">{yuan(city.rent_single)}</span></div>
          <div>合租 <span className="font-medium text-stone-600">{yuan(city.rent_shared)}</span></div>
        </div>
      </div>

      {city.climate_stats && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-stone-400">
          <span className="flex items-center gap-1"><Thermometer size={11} className="text-sky-500" />最冷{city.climate_stats.coldest.month}月 {city.climate_stats.coldest.temp}°C</span>
          <span className="flex items-center gap-1"><Thermometer size={11} className="text-amber-500" />最热{city.climate_stats.hottest.month}月 {city.climate_stats.hottest.temp}°C</span>
          <span className="flex items-center gap-1"><Droplets size={11} className="text-teal-500" />年降水 {city.climate_stats.annual_precip}mm</span>
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2.5">
        <CompareToggle comparing={comparing} onToggle={onToggleCompare} />
        <span className="flex items-center gap-0.5 text-[11px] text-stone-400 transition group-hover:text-emerald-700">
          查看详情 <ChevronRight size={13} />
        </span>
      </div>
    </article>
  )
}

// ---------- 列表行 ----------
export function CityRow({ city, fav, comparing, specKey, onToggleFav, onToggleCompare, onOpen, onShare }) {
  return (
    <article
      onClick={() => onOpen(city.id)}
      className="card-lift flex cursor-pointer flex-col gap-3 rounded-2xl border border-stone-200/70 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 sm:w-48 sm:flex-none">
        <div className="flex items-center gap-2">
          <h3 className="font-display truncate text-[16px] font-semibold text-stone-800">{city.name}</h3>
          {city.hot && <Flame size={13} className="flex-none text-amber-500" fill="currentColor" />}
          <button
            onClick={e => { e.stopPropagation(); onToggleFav() }}
            className={`ml-auto flex h-7 w-7 items-center justify-center rounded-full sm:hidden
              ${fav ? 'bg-rose-50 text-rose-500' : 'text-stone-300'}`}
          >
            <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-stone-400">
          {city.province} · {city.parent || city.region} · {city.type}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <CleanBadge clean={city.clean50} size="xs" />
          <UniBadge uni={city.uni_town} size="xs" />
          <MedBadge med={city.med} size="xs" />
          <SpecBadge city={city} specKey={specKey} size="xs" />
          <BorderBadge city={city} size="xs" />
          <SafetyBadge city={city} size="xs" />
          {city.tags.slice(0, 2).map(t => <TagChip key={t} tag={t} size="xs" />)}
        </div>
        {city.dishes?.length > 0 && (
          <div
            title={`地方名菜：${city.dishes.join('、')}`}
            className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-orange-600/90"
          >
            <UtensilsCrossed size={10} className="flex-none" />
            <span className="truncate">
              {city.dishes.slice(0, 2).join(' · ')}{city.dishes.length > 2 ? ` +${city.dishes.length - 2}` : ''}
            </span>
          </div>
        )}
        <MedList city={city} size="xs" />
        <RestList city={city} size="xs" />
      </div>

      <div className="grid flex-1 grid-cols-3 gap-2">
        <div>
          <div className="text-[10px] text-stone-400">主卧合租</div>
          <div className="text-[14px] font-semibold text-stone-700">{yuan(city.rent_shared)}</div>
        </div>
        <div>
          <div className="text-[10px] text-stone-400">单人整租</div>
          <div className="text-[14px] font-semibold text-stone-700">{yuan(city.rent_single)}</div>
        </div>
        <div>
          <div className="text-[10px] text-emerald-700/70">月总支出</div>
          <div className="text-[14px] font-bold text-emerald-800">{yuan(city.monthly_total)}</div>
        </div>
      </div>

      {city.climate_stats && (
        <div className="flex flex-none items-center gap-3 text-[11px] text-stone-400 sm:flex-col sm:items-end sm:gap-1">
          <span className="flex items-center gap-1"><Thermometer size={11} className="text-sky-500" />最冷{city.climate_stats.coldest.month}月 {city.climate_stats.coldest.temp}°C</span>
          <span className="flex items-center gap-1"><Thermometer size={11} className="text-amber-500" />最热{city.climate_stats.hottest.month}月 {city.climate_stats.hottest.temp}°C</span>
          <span className="flex items-center gap-1"><Droplets size={11} className="text-teal-500" />{city.climate_stats.annual_precip}mm</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <CompareToggle comparing={comparing} onToggle={onToggleCompare} />
        <button
          onClick={e => { e.stopPropagation(); onShare(city) }}
          aria-label="生成分享图片"
          title="生成分享图片（可转发微信）"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-emerald-600"
        >
          <Share2 size={15} />
        </button>
        <FavButton fav={fav} onToggle={onToggleFav} />
      </div>
    </article>
  )
}
