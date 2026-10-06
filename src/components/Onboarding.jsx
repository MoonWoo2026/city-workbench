import { useEffect, useState, useCallback } from 'react'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'

const KEY = 'cw:onboarded'
const ASK_KEY = 'cw:onboard-asked' // 「不用啦」次数：前 3 次访问仍会询问，防第一次手滑跳过
const MAX_ASK = 3

// 新手指引：分享链接访客（s=1）首次打开时触发
// 欢迎卡 → 聚光灯分步导览核心功能 → 完成标记 localStorage

const STEPS = [
  {
    selector: null, // 居中欢迎
    title: '欢迎来到「去哪躺平」',
    desc: '这里收录了全国 2896 个低成本旅居地，房租、物价、气候、网络、交通都替你查好了。花 20 秒，带你认识一下。',
  },
  {
    selector: '[data-tour="search"]',
    title: '直接搜你想去的地方',
    desc: '城市名、拼音、省份、县区、标签都行，比如「腾冲」「kunming」「温泉」。',
  },
  {
    selector: '[data-tour="trio"]',
    title: '三种方式找城市',
    desc: '按预算：告诉它你每月能花多少；按区域：挑省份、租金档、气候；按图：直接在地图上看全国分布。',
  },
  {
    selector: '[data-tour="card"]',
    title: '点开卡片看完整档案',
    desc: '每张卡片是一座小城的缩影。点进去有租金明细、气候、网络、高铁机场、大学城攻略，还能生成图片分享给朋友。',
  },
  {
    selector: '[data-tour="assistant"]',
    title: '懒人的话，直接说',
    desc: '右下角「找城市」是小助手。说一句「云南 1500 以下有温泉的县城」，它自动帮你筛好，还给出最优选和理由。',
  },
  {
    selector: null,
    title: '开始你的探索吧',
    desc: '作为访客，你有 30 分钟随意逛。看中哪里，点左上角收藏，或直接问分享给你的朋友。',
  },
]

export default function Onboarding() {
  // asked: 等待用户选择是否首次来；step: 导览步骤索引；null 系列 = 不显示
  const [phase, setPhase] = useState('idle') // idle | ask | tour | done

  useEffect(() => {
    const isGuest = new URLSearchParams(window.location.search).get('s') === '1'
    let done = false, asked = 0
    try {
      done = !!localStorage.getItem(KEY)
      asked = +localStorage.getItem(ASK_KEY) || 0
    } catch { /* ignore */ }
    if (isGuest && !done && asked < MAX_ASK) setPhase('ask')
  }, [])

  // 「不用啦，我自己看」：记一次跳过，第 3 次跳过后才永久不再询问
  const dismiss = useCallback(() => {
    try {
      const n = (+localStorage.getItem(ASK_KEY) || 0) + 1
      localStorage.setItem(ASK_KEY, String(n))
      if (n >= MAX_ASK) localStorage.setItem(KEY, '1')
    } catch { /* ignore */ }
    setPhase('done')
  }, [])

  // 「再看一次」入口：左下角 ? 按钮派发 cw:replay-tour，直接进导览（不再问是否首次）
  useEffect(() => {
    const replay = () => setPhase('tour')
    window.addEventListener('cw:replay-tour', replay)
    return () => window.removeEventListener('cw:replay-tour', replay)
  }, [])

  const finish = useCallback(() => {
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setPhase('done')
  }, [])

  if (phase === 'ask') return <AskCard onYes={() => setPhase('tour')} onNo={dismiss} />
  if (phase === 'tour') return <Tour onDone={finish} />
  return null
}

// 首次询问卡
function AskCard({ onYes, onNo }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-stone-900/45 px-6 backdrop-blur-[3px]">
      <div className="animate-pop-in w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <img
          src="/logo.jpg"
          alt="去哪躺平"
          className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover shadow-sm ring-1 ring-stone-200/70"
        />
        <h2 className="font-display text-[20px] font-bold text-stone-900">欸？抓住一只新来的小伙伴！</h2>
        <p className="mt-2 text-[13px] leading-6 text-stone-500">
          这里有朋友分享给你的「低成本旅居城市指南」。<br />第一次来的话，不如让我用 20 秒带你熟悉一下怎么快乐「躺平」？
        </p>
        <button
          onClick={onYes}
          className="mt-5 w-full rounded-full bg-emerald-600 py-2.5 text-[13px] font-medium text-white transition hover:bg-emerald-700"
        >
          好呀，带我逛逛
        </button>
        <button
          onClick={onNo}
          className="mt-2 w-full rounded-full py-2 text-[12px] text-stone-400 transition hover:text-stone-600"
        >
          不用啦，我自己看
        </button>
      </div>
    </div>
  )
}

// 聚光灯分步导览
function Tour({ onDone }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const isGuest = new URLSearchParams(window.location.search).get('s') === '1'
  const last = i === STEPS.length - 1
  // 重播者多半是主人本人：最后一步的「访客 30 分钟」提示换成通用文案
  const step = last && !isGuest
    ? { ...STEPS[i], desc: '看中哪里，点卡片上的爱心收藏，慢慢挑。祝你找到心安之处。' }
    : STEPS[i]

  useEffect(() => {
    if (!step.selector) { setRect(null); return }
    const el = document.querySelector(step.selector)
    if (!el) { setRect(null); return }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => {
      const r = el.getBoundingClientRect()
      setRect({ x: r.x, y: r.y, w: r.width, h: r.height })
    }, 350)
    return () => clearTimeout(t)
  }, [i, step.selector])

  // 窗口变化时重算高亮位置
  useEffect(() => {
    if (!step.selector) return
    const update = () => {
      const el = document.querySelector(step.selector)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ x: r.x, y: r.y, w: r.width, h: r.height })
      }
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [i, step.selector])

  const pad = 8
  const tipBelow = rect ? rect.y + rect.h + pad + 130 < window.innerHeight : true

  return (
    <div className="fixed inset-0 z-[75]">
      {/* 遮罩：高亮区域挖空（用大 box-shadow 实现） */}
      {rect ? (
        <>
          <div
            className="absolute rounded-2xl transition-all duration-300"
            style={{
              left: rect.x - pad, top: rect.y - pad,
              width: rect.w + pad * 2, height: rect.h + pad * 2,
              boxShadow: '0 0 0 9999px rgba(28,25,23,0.55)',
            }}
          />
          <div
            className="absolute rounded-2xl ring-2 ring-emerald-400 transition-all duration-300"
            style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-stone-900/55" />
      )}

      {/* 提示卡 */}
      <div
        className={`absolute px-4 ${rect ? '' : 'flex h-full w-full items-center justify-center'}`}
        style={rect ? {
          left: Math.max(16, Math.min(rect.x, window.innerWidth - 356)),
          top: tipBelow ? rect.y + rect.h + pad + 12 : Math.max(16, rect.y - pad - 150),
          width: 340,
        } : undefined}
      >
        <div className="animate-pop-in rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold text-stone-900">{step.title}</h3>
            <button onClick={onDone} className="flex-none text-stone-300 transition hover:text-stone-500" title="跳过导览">
              <X size={15} />
            </button>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-5 text-stone-500">{step.desc}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, j) => (
                <span key={j} className={`h-1 rounded-full transition-all ${j === i ? 'w-4 bg-emerald-600' : 'w-1 bg-stone-200'}`} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {i > 0 && (
                <button
                  onClick={() => setI(i - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50"
                >
                  <ArrowLeft size={13} />
                </button>
              )}
              <button
                onClick={() => (last ? onDone() : setI(i + 1))}
                className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-emerald-700"
              >
                {last ? '开始探索' : '下一步'}{!last && <ArrowRight size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
