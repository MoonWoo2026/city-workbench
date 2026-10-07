import { useEffect } from 'react'
import { X, ShieldCheck, XCircle, MapPin, Droplets, Thermometer, Star, GraduationCap, BusFront, Wind, Landmark } from 'lucide-react'
import { TagChip, CleanBadge, PM25Badge, FiscalBadge, yuan } from './CityCard.jsx'

function Cell({ children, highlight = false, strong = false }) {
  return (
    <td
      className={`align-top px-3 py-3 text-[12.5px] leading-6
        ${highlight ? 'bg-emerald-50/80 font-semibold text-emerald-800' : 'text-stone-600'}
        ${strong ? 'font-semibold text-stone-800' : ''}`}
    >
      {children}
    </td>
  )
}

function ListCell({ items }) {
  return (
    <ul className="space-y-1">
      {items.map(t => <li key={t} className="flex items-start gap-1"><span className="mt-2 h-1 w-1 flex-none rounded-full bg-stone-400" />{t}</li>)}
    </ul>
  )
}

export default function CompareModal({ cities, onClose, onRemove }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!cities.length) return null

  const cheapest = key => {
    const min = Math.min(...cities.map(c => c[key]))
    return new Set(cities.filter(c => c[key] === min).map(c => c.id))
  }
  const cheapShared = cheapest('rent_shared')
  const cheapSingle = cheapest('rent_single')
  const cheapTotal = cheapest('monthly_total')

  const rows = [
    { label: '所属 / 类型', render: c => <>{c.province} · {c.parent || c.type}<br /><span className="text-stone-400">{c.region}</span></> },
    {
      label: '大学城周边',
      icon: <GraduationCap size={12} className="text-indigo-500" />,
      render: c => c.uni_town ? (
        <div className="space-y-1.5">
          <p className="font-medium text-indigo-700">{c.uni_town.areas[0]}</p>
          {c.uni_town.areas.length > 1 && <p className="text-stone-400">{c.uni_town.areas.slice(1).join('；')}</p>}
          <p className="flex items-start gap-1 text-stone-500"><BusFront size={11} className="mt-1 flex-none" />{c.uni_town.transit}</p>
          <p className="text-stone-500">{c.uni_town.food}</p>
          <p className="text-stone-400">{c.uni_town.grocery}</p>
        </div>
      ) : <span className="text-stone-300">— 无集中大学城</span>,
    },
    { label: '典型主卧合租', price: 'rent_shared', cheapSet: cheapShared, render: c => <span className="text-[15px] font-bold">{yuan(c.rent_shared)}</span> },
    { label: '典型单人整租', price: 'rent_single', cheapSet: cheapSingle, render: c => <span className="text-[15px] font-bold">{yuan(c.rent_single)}</span> },
    { label: '预估月总支出', price: 'monthly_total', cheapSet: cheapTotal, render: c => <span className="text-[15px] font-bold">{yuan(c.monthly_total)}</span> },
    {
      label: '物价 / 水电气',
      icon: <Droplets size={12} className="text-sky-500" />,
      render: c => (
        <div className="space-y-1">
          <p>{c.food}</p>
          <p className="text-stone-400">{c.utilities}</p>
        </div>
      ),
    },
    {
      label: '气候',
      icon: <Thermometer size={12} className="text-teal-600" />,
      render: c => <div className="space-y-1.5"><p>{c.climate}</p><div className="flex flex-wrap gap-1">{c.tags.map(t => <TagChip key={t} tag={t} size="xs" />)}</div></div>,
    },
    {
      label: 'PM2.5（周均）',
      icon: <Wind size={12} className="text-teal-600" />,
      render: c => c.pm25?.v
        ? <PM25Badge pm25={c.pm25} size="xs" />
        : <span className="text-stone-300">— 暂无数据</span>,
    },
    {
      label: '公共服务保障',
      icon: <Landmark size={12} className="text-stone-600" />,
      render: c => c.fiscal?.score
        ? <FiscalBadge fiscal={c.fiscal} size="xs" />
        : <span className="text-stone-300">— 暂无数据</span>,
    },
    {
      label: '生态环境（50km）',
      icon: <ShieldCheck size={12} className="text-emerald-600" />,
      render: c => (
        <div className="space-y-1.5">
          <CleanBadge clean={c.clean50} size="xs" />
          <p>{c.environment}</p>
        </div>
      ),
    },
    { label: '优势', icon: <Star size={12} className="text-emerald-500" />, render: c => <ListCell items={c.pros} /> },
    { label: '劣势 / 踩雷点', icon: <XCircle size={12} className="text-rose-400" />, render: c => <ListCell items={c.cons} /> },
    { label: '推荐租房区域', icon: <MapPin size={12} className="text-emerald-700" />, render: c => <ListCell items={c.areas} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-stone-900/45 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-pop-in relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-[19px] font-bold tracking-tight text-stone-900">城市横向对比</h2>
            <p className="mt-0.5 text-[12px] text-stone-400">绿色高亮 = 当前对比中该维度最便宜 · 最多同时对比 3 个城市</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-28 sticky left-0 z-[1] bg-paper px-3 py-2" />
                {cities.map(c => (
                  <th key={c.id} className="min-w-[190px] px-3 py-2 text-left align-top">
                    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-[15px] font-bold text-stone-900">{c.name}</div>
                          <div className="mt-0.5 text-[11px] text-stone-400">{c.province} · {c.parent || c.type}</div>
                        </div>
                        <button
                          onClick={() => onRemove(c.id)}
                          className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-stone-300 hover:bg-rose-50 hover:text-rose-500"
                          title="移出对比"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.label} className={ri % 2 ? 'bg-white/50' : ''}>
                  <td className="sticky left-0 z-[1] bg-paper/95 px-3 py-3 align-top backdrop-blur">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
                      {row.icon}{row.label}
                    </span>
                  </td>
                  {cities.map(c => (
                    <Cell
                      key={c.id}
                      highlight={row.cheapSet ? row.cheapSet.has(c.id) : false}
                      strong={row.label === '所属 / 类型'}
                    >
                      {row.render(c)}
                    </Cell>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-stone-200/70 bg-white px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-full bg-stone-800 px-6 py-2 text-[13px] font-medium text-white transition hover:bg-stone-900"
          >
            完成对比
          </button>
        </div>
      </div>
    </div>
  )
}
