import { Database, SlidersHorizontal, Heart, Scale } from 'lucide-react'

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-wide text-stone-400">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tracking-tight text-stone-800">{value}</span>
          <span className="text-[11px] text-stone-400">{sub}</span>
        </div>
      </div>
    </div>
  )
}

export default function StatBar({ total, matched, favCount, compareCount }) {
  const pct = total ? Math.round((matched / total) * 100) : 0
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={<Database size={18} className="text-stone-600" />}
        accent="bg-stone-100"
        label="已收录城市总数"
        value={total}
        sub="31 省份 · 七大区"
      />
      <StatCard
        icon={<SlidersHorizontal size={18} className="text-emerald-700" />}
        accent="bg-emerald-50"
        label="符合当前筛选"
        value={matched}
        sub={`占比 ${pct}%`}
      />
      <StatCard
        icon={<Heart size={18} className="text-rose-500" />}
        accent="bg-rose-50"
        label="我的收藏 / 想去"
        value={favCount}
        sub="仅存本机"
      />
      <StatCard
        icon={<Scale size={18} className="text-amber-600" />}
        accent="bg-amber-50"
        label="已加入对比"
        value={compareCount}
        sub="勾选 2-3 个"
      />
    </div>
  )
}
