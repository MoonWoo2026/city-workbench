import { useState } from 'react'
import { Sparkles, X, CornerDownRight } from 'lucide-react'
import { refineInterpret } from '../lib/assistant.js'

// 小助理微调条：常驻在结果区上方，筛完后直接说「排除北方城市」这类话
// 每条排除变成一个可单独移除的胶囊，不打断当前浏览
export default function RefineBar({ filters, onApply }) {
  const [input, setInput] = useState('')
  const [miss, setMiss] = useState(false) // 识别失败提示
  const excl = filters.excl || []

  const submit = () => {
    const text = input.trim()
    if (!text) return
    const r = refineInterpret(text, filters)
    if (r) {
      onApply(r.next)
      setInput('')
      setMiss(false)
    } else {
      setMiss(true)
      setTimeout(() => setMiss(false), 2200)
    }
  }

  const removeExcl = idx => onApply({ ...filters, excl: excl.filter((_, i) => i !== idx) })

  return (
    <div className="mb-3 rounded-2xl border border-emerald-600/15 bg-emerald-50/40 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-600 text-white">
          <Sparkles size={13} />
        </span>
        <div className="relative min-w-0 flex-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder={miss ? '没听懂，试试「排除北方城市」「只要县城」「去掉有工业的」' : '对当前结果再说一句：排除北方城市 / 只要南方 / 去掉有工业的…'}
            className={`w-full rounded-full border bg-white py-1.5 pl-3 pr-9 text-[12.5px] text-stone-700 outline-none transition placeholder:text-stone-300
              ${miss ? 'border-rose-300 ring-2 ring-rose-500/15' : 'border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15'}`}
          />
          <button
            onClick={submit}
            aria-label="应用微调"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            <CornerDownRight size={14} />
          </button>
        </div>
      </div>
      {excl.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
          {excl.map((e, i) => (
            <span
              key={e.label}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-600/20"
            >
              {e.label}
              <button onClick={() => removeExcl(i)} aria-label={`移除${e.label}`} className="text-stone-300 transition hover:text-rose-500">
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={() => onApply({ ...filters, excl: [] })}
            className="text-[11px] text-stone-400 underline-offset-2 transition hover:text-stone-600 hover:underline"
          >
            清空微调
          </button>
        </div>
      )}
    </div>
  )
}
