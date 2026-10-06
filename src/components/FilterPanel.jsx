import { useMemo, useState } from 'react'
import {
  Map as MapIcon, BedDouble, Home, ShieldCheck, ChevronDown, RotateCcw, Check, Sparkles,
} from 'lucide-react'
import { RENT_LEVELS, LIVING_TYPES, CLIMATE_TAGS, REGION_ORDER, PREFS } from '../lib/constants.js'

function CheckBox({ checked, partial, onClick, label, sub, tone = 'emerald' }) {
  const toneBg = tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-600'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition
        ${checked ? 'bg-stone-100/80' : 'hover:bg-stone-100/60'}`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-[6px] border transition
          ${checked ? `${toneBg} border-transparent text-white` : 'border-stone-300 bg-white group-hover:border-stone-400'}`}
      >
        {checked && !partial && <Check size={11} strokeWidth={3.2} />}
        {partial && <span className="h-0.5 w-2 rounded-full bg-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] leading-5 ${checked ? 'font-medium text-stone-800' : 'text-stone-600'}`}>
          {label}
        </span>
        {sub && <span className="block text-[11px] leading-4 text-stone-400">{sub}</span>}
      </span>
    </button>
  )
}

function SectionTitle({ icon, title, extra }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-stone-700">
        {icon}
        {title}
      </div>
      {extra}
    </div>
  )
}

export default function FilterPanel({ filters, patch, regionTree, resetAll, banner = false }) {
  const [openRegions, setOpenRegions] = useState(() => new Set(REGION_ORDER))
  const provCount = useMemo(() => {
    const m = {}
    for (const g of regionTree) for (const p of g.provinces) m[p.province] = p.count
    return m
  }, [regionTree])

  const allProvinces = useMemo(
    () => regionTree.flatMap(g => g.provinces.map(p => p.province)),
    [regionTree],
  )

  const toggleSet = (key, value) => {
    const set = new Set(filters[key])
    set.has(value) ? set.delete(value) : set.add(value)
    patch({ [key]: [...set] })
  }

  const toggleRegion = (provs) => {
    const set = new Set(filters.provinces)
    const allOn = provs.every(p => set.has(p))
    provs.forEach(p => (allOn ? set.delete(p) : set.add(p)))
    patch({ provinces: [...set] })
  }

  const toggleAllTypes = () =>
    patch({ types: filters.types.length === LIVING_TYPES.length ? [] : LIVING_TYPES.map(t => t.key) })

  return (
    <div className={banner
      ? 'gap-5 md:columns-2 xl:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid'
      : 'space-y-6'
    }>
      {/* 区域 / 省份 */}
      <section>
        <SectionTitle
          icon={<MapIcon size={14} className="text-emerald-700" />}
          title="区域 / 省份"
          extra={
            <button
              onClick={() => patch({ provinces: filters.provinces.length ? [] : allProvinces })}
              className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
            >
              {filters.provinces.length ? '清空选择' : '全国全选'}
            </button>
          }
        />
        <div className={`space-y-1 ${banner ? 'max-h-[380px] overflow-y-auto pr-1' : ''}`}>
          {REGION_ORDER.map(regionName => {
            const group = regionTree.find(g => g.region === regionName)
            if (!group) return null
            const provs = group.provinces.map(p => p.province)
            const onCount = provs.filter(p => filters.provinces.includes(p)).length
            const open = openRegions.has(regionName)
            return (
              <div key={regionName} className="rounded-xl border border-stone-200/70 bg-white/60">
                <div className="flex items-center">
                  <CheckBox
                    checked={onCount === provs.length}
                    partial={onCount > 0 && onCount < provs.length}
                    onClick={() => toggleRegion(provs)}
                    label={`${regionName}（${group.provinces.reduce((s, p) => s + p.count, 0)}）`}
                  />
                  <button
                    onClick={() => {
                      const next = new Set(openRegions)
                      next.has(regionName) ? next.delete(regionName) : next.add(regionName)
                      setOpenRegions(next)
                    }}
                    className="mr-2 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  >
                    <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
                  </button>
                </div>
                {open && (
                  <div className="grid grid-cols-2 gap-x-1 px-1.5 pb-2">
                    {group.provinces.map(p => {
                      const on = filters.provinces.includes(p.province)
                      return (
                        <button
                          key={p.province}
                          onClick={() => toggleSet('provinces', p.province)}
                          className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[12px] transition
                            ${on ? 'bg-emerald-50 font-medium text-emerald-800' : 'text-stone-500 hover:bg-stone-100'}`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[4px] border transition
                              ${on ? 'border-transparent bg-emerald-600 text-white' : 'border-stone-300 bg-white'}`}
                          >
                            {on && <Check size={9} strokeWidth={3.5} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.province}</span>
                          <span className="text-[10px] text-stone-400">{provCount[p.province]}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 房租档位 */}
      <section>
        <SectionTitle
          icon={<BedDouble size={14} className="text-emerald-700" />}
          title="房租档位（单人整租）"
          extra={
            <button
              onClick={() => patch({ levels: filters.levels.length ? [] : RENT_LEVELS.map(l => l.key) })}
              className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
            >
              {filters.levels.length ? '清空' : '全选'}
            </button>
          }
        />
        <div className="space-y-1">
          {RENT_LEVELS.map(l => {
            const checked = filters.levels.includes(l.key)
            return (
              <button
                key={l.key}
                onClick={() => toggleSet('levels', l.key)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition
                  ${checked
                    ? 'border-emerald-600/60 bg-emerald-50/80 ring-1 ring-emerald-600/20'
                    : 'border-stone-200 bg-white/60 hover:border-stone-300'}`}
              >
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-[6px] border text-white
                    ${checked ? 'border-transparent bg-emerald-600' : 'border-stone-300 bg-white'}`}
                >
                  {checked && <Check size={11} strokeWidth={3.2} />}
                </span>
                <span className={`text-[13px] ${checked ? 'font-medium text-stone-800' : 'text-stone-600'}`}>
                  {l.label}
                </span>
                <span className="ml-auto text-[11px] text-stone-400">{l.hint}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] leading-4 text-stone-400">
          默认勾选前三个低成本档位；3000 元以上为预留档位。
        </p>
      </section>

      {/* 居住模式 */}
      <section>
        <SectionTitle
          icon={<Home size={14} className="text-emerald-700" />}
          title="居住模式"
          extra={
            <button onClick={toggleAllTypes} className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800">
              {filters.types.length === LIVING_TYPES.length ? '清空' : '全选'}
            </button>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {LIVING_TYPES.map(t => {
            const checked = filters.types.includes(t.key)
            return (
              <button
                key={t.key}
                onClick={() => toggleSet('types', t.key)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition
                  ${checked
                    ? 'border-emerald-600/50 bg-emerald-600 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-stone-400">未选 = 不过滤，全部纳入。</p>
      </section>

      {/* 气候与特色标签 */}
      <section>
        <SectionTitle
          icon={<ShieldCheck size={14} className="text-emerald-700" />}
          title="气候与特色标签"
          extra={
            filters.tags.length > 0 && (
              <button onClick={() => patch({ tags: [] })} className="text-[11px] font-medium text-emerald-700">
                清空
              </button>
            )
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {CLIMATE_TAGS.map(t => {
            const checked = filters.tags.includes(t.key)
            return (
              <button
                key={t.key}
                onClick={() => toggleSet('tags', t.key)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] transition
                  ${checked
                    ? 'border-teal-600/50 bg-teal-600 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                <span>{t.icon}</span>
                {t.key}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-stone-400">多个标签为「同时满足」。</p>
      </section>

      {/* 环境与住宿偏好（开关式，默认都不过滤） */}
      <section>
        <SectionTitle icon={<ShieldCheck size={14} className="text-emerald-700" />} title="环境与住宿偏好" />
        <div className="space-y-1.5">
          <button
            onClick={() => patch({ cleanOnly: !filters.cleanOnly })}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition
              ${filters.cleanOnly ? 'border-emerald-600/50 bg-emerald-50' : 'border-stone-200 bg-white/60'}`}
          >
            <span className={`relative h-5 w-9 flex-none rounded-full transition ${filters.cleanOnly ? 'bg-emerald-600' : 'bg-stone-300'}`}>
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all
                  ${filters.cleanOnly ? 'left-[18px]' : 'left-0.5'}`}
              />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-stone-800">排除重污染城市</span>
              <span className="block text-[11px] text-stone-400">一键排除 50 公里内有重工业 / 化工 / 矿区的城市</span>
            </span>
          </button>
          <button
            onClick={() => patch({ uniOnly: !filters.uniOnly })}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition
              ${filters.uniOnly ? 'border-indigo-500/40 bg-indigo-50/80' : 'border-stone-200 bg-white/60'}`}
          >
            <span className={`relative h-5 w-9 flex-none rounded-full transition ${filters.uniOnly ? 'bg-indigo-500' : 'bg-stone-300'}`}>
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all
                  ${filters.uniOnly ? 'left-[18px]' : 'left-0.5'}`}
              />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-stone-800">仅看大学城周边</span>
              <span className="block text-[11px] text-stone-400">吃的多 · 交通方便 · 商超齐全（默认不开启）</span>
            </span>
          </button>
        </div>
      </section>

      {/* 生活偏好（AI 小助手识别同一套，这里可手动勾选，影响推荐排序） */}
      <section>
        <SectionTitle
          icon={<Sparkles size={14} className="text-emerald-700" />}
          title="生活偏好（优先推荐）"
          extra={
            filters.prefs?.length > 0 && (
              <button onClick={() => patch({ prefs: [] })} className="text-[11px] font-medium text-emerald-700">
                清空
              </button>
            )
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {PREFS.map(p => {
            const checked = filters.prefs?.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggleSet('prefs', p.id)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition
                  ${checked
                    ? 'border-amber-500/50 bg-amber-500 text-white shadow-sm'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-stone-400">
          勾选后系统按偏好打分排序，越符合越靠前；不改变筛选范围。
        </p>
      </section>

      <button
        onClick={resetAll}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 py-2.5 text-[12px] text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
      >
        <RotateCcw size={13} />
        重置全部筛选
      </button>
    </div>
  )
}
