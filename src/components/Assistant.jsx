import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Bot, Undo2, RotateCcw, Trophy, ExternalLink } from 'lucide-react'
import { interpret, rankResults, SUGGESTIONS } from '../lib/assistant.js'
import { applyFilters, defaultFilters, encodeFilters } from '../lib/store.js'

// 躺平小助手：自然语言 → 自动筛选（纯前端识别）
export default function Assistant({ cities, filters, favs, favOnly, lifted, onApplyFilters, onSetFavOnly, onReset, onOpen }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([]) // 筛选快照栈（供撤销）
  const [messages, setMessages] = useState(() => [{
    id: 'greet',
    role: 'bot',
    kind: 'greet',
  }])
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const composing = useRef(false)
  const seq = useRef(0)
  const nextId = () => `m${++seq.current}`

  const totalAll = cities.length

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  const pushMsg = msg => setMessages(prev => [...prev, { id: nextId(), ...msg }])

  // 计算当前筛选下真实命中数（考虑只看收藏）
  const countOf = f => applyFilters(cities, f, { favs, favOnly }).length

  // 点城市名：收起面板并打开详情弹窗
  const openCity = id => { setOpen(false); onOpen?.(id) }

  // 新页面查看同一筛选视图（复用分享链接的 URL 编码）
  const openInNewPage = f => {
    const qs = encodeFilters(f)
    window.open(`${window.location.pathname}${qs ? `?${qs}` : ''}`, '_blank')
  }

  const send = raw => {
    const text = raw.trim()
    if (!text) return
    pushMsg({ role: 'user', text })
    setInput('')

    const r = interpret(text, filters, { favOnly })

    if (r.kind === 'plan') {
      setHistory(h => [...h, { filters, favOnly }])
      onApplyFilters(r.next)
      const matched = applyFilters(cities, r.next, { favs, favOnly })
      const count = matched.length
      const ranked = count ? rankResults(matched, r.next) : []
      pushMsg({ role: 'bot', kind: 'plan', items: r.items, count, relaxed: r.relaxed || [], ranked, filtersNext: r.next })
      return
    }
    if (r.kind === 'reset') {
      setHistory(h => [...h, { filters, favOnly }])
      onReset()
      pushMsg({ role: 'bot', kind: 'reset', count: countOf(defaultFilters()) })
      return
    }
    if (r.kind === 'undo') {
      setHistory(h => {
        if (!h.length) {
          pushMsg({ role: 'bot', kind: 'info', text: '还没有可以撤销的操作，先告诉我你想去哪里吧～' })
          return h
        }
        const last = h[h.length - 1]
        onApplyFilters(last.filters)
        if (last.favOnly !== favOnly) onSetFavOnly(last.favOnly)
        pushMsg({ role: 'bot', kind: 'undo', count: countOf(last.filters) })
        return h.slice(0, -1)
      })
      return
    }
    if (r.kind === 'fav') {
      setHistory(h => [...h, { filters, favOnly }])
      onSetFavOnly(r.favOnly)
      pushMsg(r.favOnly
        ? { role: 'bot', kind: 'info', text: '好，只看你收藏的地方。说「看全部」可退出。' }
        : { role: 'bot', kind: 'info', text: '已退出收藏视图，显示全部结果。' })
      return
    }
    if (r.kind === 'help') {
      pushMsg({ role: 'bot', kind: 'help' })
      return
    }
    pushMsg({ role: 'bot', kind: 'unknown', raw: text })
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && !composing.current) {
      e.preventDefault()
      send(input)
    }
  }

  const chipsRow = (list, cls) => (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {list.map((c, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
          <span className="opacity-60">{c.label}：</span>{c.value}
        </span>
      ))}
    </div>
  )

  return (
    <>
      {/* 悬浮入口按钮 */}
      <button
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 80) }}
        title="躺平小助手 · 说句话就帮你筛"
        className={`fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-700/25 transition hover:scale-105 active:scale-95 ${lifted ? 'bottom-24' : 'bottom-5'} right-4 sm:right-6`}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="animate-pop-in fixed bottom-20 right-4 z-50 flex h-[min(540px,74vh)] w-[calc(100%-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-stone-200 sm:right-6">
          {/* 头部 */}
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-emerald-700 to-teal-700 px-4 py-3 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <Bot size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                躺平小助手
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-px text-[10px] font-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />本地识别 · 一说即筛
                </span>
              </div>
              <div className="text-[11px] text-emerald-50/80">说句话就行，比如「云南 1500 以下有温泉的县城」</div>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => send('撤销')}
                title="撤销上一步筛选"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20"
              >
                <Undo2 size={15} />
              </button>
            )}
          </div>

          {/* 消息区 */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-stone-50/70 px-3.5 py-3.5">
            {messages.map(m => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-br-md bg-stone-900 px-3.5 py-2 text-[13px] leading-5 text-white">
                      {m.text}
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} className="flex gap-2">
                  <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Bot size={15} />
                  </span>
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13px] leading-5 text-stone-700 ring-1 ring-stone-200/70">
                    {m.kind === 'greet' && (
                      <div>
                        <p>你好呀，我是躺平小助手 🐾</p>
                        <p className="mt-1 text-stone-500">直接用大白话说需求，我帮你筛城市：</p>
                        <div className="mt-1.5 space-y-1 text-[12px] text-stone-500">
                          <p>· 省份/大区：「云南的」「东三省」「西南地区」</p>
                          <p>· 预算：「1500 以下」「1000 到 2000」「3000 左右」</p>
                          <p>· 偏好：「有温泉」「海边」「空气好」「有暖气」</p>
                          <p>· 类型：「县城小镇」「三四线」「大城市郊区」</p>
                          <p>· 还可以说「过冬暖和」「最便宜」「重置」「撤销」</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => send(s)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] text-emerald-700 ring-1 ring-emerald-600/15 transition hover:bg-emerald-100">
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.kind === 'plan' && (
                      <div>
                        <p className="font-medium text-stone-800">
                          {m.count > 0 ? `已识别 ${m.items.length} 个条件，帮你筛好了` : '条件都识别到了，但没有完全匹配的地方'}
                        </p>
                        {chipsRow(m.items, 'bg-emerald-50 text-emerald-800 ring-emerald-600/15')}
                        {m.relaxed?.length > 0 && (
                          <p className="mt-1.5 text-[11.5px] text-amber-600">
                            {m.relaxed.join('，')}（否则没有结果）
                          </p>
                        )}
                        {m.count > 0 ? (
                          <div className="mt-2 space-y-2">
                            {/* 最优选 + 理由 */}
                            <div className="rounded-xl bg-amber-50/90 px-2.5 py-2 ring-1 ring-amber-200/70">
                              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                <Trophy size={11} /> 最优选
                              </p>
                              <button onClick={() => openCity(m.ranked[0].city.id)} className="mt-0.5 text-left transition hover:text-emerald-700">
                                <span className="text-[14px] font-semibold text-stone-800">{m.ranked[0].city.name}</span>
                                <span className="ml-1 text-[11px] font-normal text-stone-400">{m.ranked[0].city.province} · 点我看详情</span>
                              </button>
                              <p className="mt-0.5 text-[11.5px] leading-[1.5] text-stone-500">{m.ranked[0].reason}</p>
                            </div>
                            {/* 备选 */}
                            {m.ranked.length > 1 && (
                              <div className="space-y-1">
                                {m.ranked.slice(1, 3).map(r => (
                                  <button key={r.city.id} onClick={() => openCity(r.city.id)} className="block w-full rounded-lg bg-stone-50 px-2.5 py-1.5 text-left ring-1 ring-stone-200/60 transition hover:bg-emerald-50/70">
                                    <span className="text-[12.5px] font-medium text-stone-700">{r.city.name}</span>
                                    <span className="ml-1.5 text-[11px] text-stone-400">整租 ¥{r.city.rent_single} · 月支 ¥{r.city.monthly_total}</span>
                                    {r.why.length > 0 && <span className="ml-1.5 text-[10.5px] text-emerald-600">{r.why.join(' · ')}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* 完整合集 */}
                            <div>
                              <p className="text-[12px] text-stone-500">完整合集 · 共 <b className="text-emerald-700">{m.count}</b> 个地方：</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(m.count <= 15 ? m.ranked : m.ranked.slice(0, 15)).map(r => (
                                  <button key={r.city.id} onClick={() => openCity(r.city.id)} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 transition hover:bg-emerald-100 hover:text-emerald-800">
                                    {r.city.name}
                                  </button>
                                ))}
                                {m.count > 15 && <span className="self-center text-[11px] text-stone-400">等 {m.count} 个…</span>}
                              </div>
                            </div>
                            {/* 两种查看方式 */}
                            <div className="flex gap-1.5 pt-0.5">
                              <button
                                onClick={() => openInNewPage(m.filtersNext)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-emerald-700"
                              >
                                <ExternalLink size={11} /> 新页面看全部
                              </button>
                              <button
                                onClick={() => setOpen(false)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-stone-900 px-2.5 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-stone-700"
                              >
                                关掉面板看结果
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-[12px] text-stone-500">试试放宽预算，或说「不限制大学城」「重置」。</p>
                            <button
                              onClick={() => send('重置')}
                              className="mt-2 flex items-center gap-1 rounded-full bg-stone-900 px-3 py-1.5 text-[12px] text-white"
                            >
                              <RotateCcw size={12} />重置筛选
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {m.kind === 'reset' && (
                      <div>
                        <p className="font-medium text-stone-800">已重置为默认筛选</p>
                        <p className="mt-0.5 text-[12.5px] text-stone-500">全国 {m.count} 个符合默认条件的地方，重新开始挑吧～</p>
                      </div>
                    )}

                    {m.kind === 'undo' && (
                      <div>
                        <p className="font-medium text-stone-800">已撤销上一步</p>
                        <p className="mt-0.5 text-[12.5px] text-stone-500">当前有 <b className="text-emerald-700">{m.count}</b> 个地方符合条件。</p>
                      </div>
                    )}

                    {m.kind === 'info' && <p>{m.text}</p>}

                    {m.kind === 'help' && (
                      <div>
                        <p>我能听懂这些说法：</p>
                        <div className="mt-1 space-y-1 text-[12px] text-stone-500">
                          <p>📍 <b>地区</b>：云南 / 东三省 / 西南 / 不要新疆</p>
                          <p>💰 <b>预算</b>：1000 以下 / 1500 到 2500 / 3000 左右 / 越便宜越好</p>
                          <p>🌊 <b>偏好</b>：温泉 / 海边 / 避暑 / 空气好 / 有暖气 / 南方湿润</p>
                          <p>🏘️ <b>类型</b>：县城小镇 / 三四线 / 大城市郊区 / 一二线</p>
                          <p>☀️ <b>场景</b>：过冬暖和 / 大学城周边 / 只看收藏</p>
                          <p>🔧 <b>操作</b>：重置 / 撤销 / 按整租价格排序</p>
                        </div>
                        <p className="mt-1.5 text-[12px] text-stone-500">条件可以叠加着说，比如「广西的海边县城，1500 左右，空气好」。</p>
                      </div>
                    )}

                    {m.kind === 'unknown' && (
                      <div>
                        <p>这句我没完全听懂 🐶 可以换个说法，或者直接点下面的例子：</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {SUGGESTIONS.slice(0, 4).map(s => (
                            <button key={s} onClick={() => send(s)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] text-emerald-700 ring-1 ring-emerald-600/15 transition hover:bg-emerald-100">
                              {s}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => send('帮助')} className="mt-2 text-[12px] text-stone-400 underline-offset-2 hover:underline">
                          查看全部指令
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 快捷指令 */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-stone-100 bg-white px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {['云南温泉', '海边小城', '过冬暖和', '空气好', '有暖气', '越便宜越好', '重置'].map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex-none rounded-full border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-500 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                {s}
              </button>
            ))}
          </div>

          {/* 输入区 */}
          <div className="flex items-center gap-2 bg-white px-3 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onCompositionStart={() => { composing.current = true }}
              onCompositionEnd={() => { composing.current = false }}
              placeholder="说需求，如：腾冲、1500以下、有温泉…"
              className="min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-3.5 py-2 text-[13px] text-stone-700 outline-none transition placeholder:text-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-200"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
