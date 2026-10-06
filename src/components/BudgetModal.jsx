import { useMemo, useState } from 'react'
import { X, Wallet, BedDouble, Home as HomeIcon, Wand2 } from 'lucide-react'
import { splitBudget, budgetTotal } from '../lib/store.js'

const FIELDS = [
  { k: 'rent', label: '房租' },
  { k: 'food', label: '餐饮' },
  { k: 'utils', label: '杂费（水电网）' },
  { k: 'transit', label: '交通' },
  { k: 'other', label: '其他' },
]

// 按预算查找城市：输入各项月度预算（0/留空=该项不限），匹配每城成本分项估算
export default function BudgetModal({ initial, onApply, onClose, previewCount }) {
  const [mode, setMode] = useState(initial?.mode || 'single')
  const [vals, setVals] = useState(() => ({
    rent: initial?.rent || 0,
    food: initial?.food || 0,
    utils: initial?.utils || 0,
    transit: initial?.transit || 0,
    other: initial?.other || 0,
  }))
  const [totalInput, setTotalInput] = useState('')

  const budget = useMemo(() => ({ mode, ...vals }), [mode, vals])
  const total = budgetTotal(budget)
  const count = total > 0 ? previewCount(budget) : 0

  const autoSplit = () => {
    const t = +totalInput
    if (!t || t < 500) return
    setVals(splitBudget(t))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-stone-900/45 backdrop-blur-[3px]" onClick={onClose} />
      <div className="animate-pop-in relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-stone-800">
            <Wallet size={16} className="text-emerald-700" />按预算查找城市
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition hover:bg-stone-200">
            <X size={16} />
          </button>
        </div>

        {/* 住房方式 */}
        <div className="mb-3 flex rounded-full border border-stone-200 bg-stone-50 p-0.5">
          {[
            { k: 'single', label: '单人整租', icon: HomeIcon },
            { k: 'shared', label: '主卧合租', icon: BedDouble },
          ].map(o => (
            <button
              key={o.k}
              onClick={() => setMode(o.k)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[12.5px] font-medium transition
                ${mode === o.k ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <o.icon size={13} />{o.label}
            </button>
          ))}
        </div>

        {/* 总预算快捷拆分 */}
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50/80 px-3 py-2.5 ring-1 ring-emerald-600/15">
          <span className="text-[12px] text-emerald-800">每月总预算 ¥</span>
          <input
            value={totalInput}
            onChange={e => setTotalInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && autoSplit()}
            placeholder="如 2500"
            inputMode="numeric"
            className="w-20 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[13px] font-semibold text-emerald-900 outline-none focus:border-emerald-500"
          />
          <button
            onClick={autoSplit}
            className="ml-auto flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-emerald-700"
          >
            <Wand2 size={12} />自动拆分
          </button>
        </div>

        {/* 分项预算 */}
        <div className="space-y-2">
          {FIELDS.map(f => (
            <div key={f.k} className="flex items-center gap-3">
              <span className="w-24 flex-none text-[12.5px] text-stone-600">{f.label}</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-stone-400">¥</span>
                <input
                  value={vals[f.k] || ''}
                  onChange={e => setVals(v => ({ ...v, [f.k]: +e.target.value.replace(/\D/g, '') || 0 }))}
                  placeholder="不限"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-7 pr-3 text-[13px] font-medium text-stone-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                />
              </div>
              <span className="w-8 flex-none text-[11px] text-stone-400">/月</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-[13px]">
          <span className="text-stone-500">合计预算：<b className="text-stone-800">¥{total || 0}</b>/月</span>
          <span className={total > 0 ? (count > 0 ? 'text-emerald-700' : 'text-amber-600') : 'text-stone-400'}>
            {total > 0 ? (count > 0 ? `${count} 个城市住得起` : '预算内暂无城市，试试调高某项') : '填入至少一项预算'}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {initial && (
            <button
              onClick={() => { onApply(null); onClose() }}
              className="rounded-full border border-stone-200 px-4 py-2.5 text-[12.5px] text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
            >
              清除预算
            </button>
          )}
          <button
            disabled={total <= 0}
            onClick={() => { onApply(budget); onClose() }}
            className="flex-1 rounded-full bg-stone-900 py-2.5 text-[13px] font-medium text-white transition enabled:hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            开始查找
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-5 text-stone-400">
          匹配口径：城市的{mode === 'shared' ? '合租主卧' : '整租一居'} + 餐饮/杂费/交通/其他的本地估算均不超过你的预算
        </p>
      </div>
    </div>
  )
}
