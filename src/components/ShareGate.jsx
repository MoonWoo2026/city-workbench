import { useEffect, useState } from 'react'

const KEY = 'cw:guest-until'
const MINUTES = 30

// 垂耳兔：摇头送客（纯 SVG + CSS 动画）
function LopRabbit() {
  return (
    <div className="rabbit-wrap">
      <svg width="180" height="190" viewBox="0 0 180 190" fill="none" aria-hidden>
        <g className="rabbit-head">
          {/* 左垂耳 */}
          <path d="M52 62 C26 78 14 118 24 152 C28 166 40 168 46 156 C56 136 60 96 62 72 Z"
            fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M50 76 C34 92 28 122 34 146 C36 154 42 155 45 147 C52 130 55 98 56 80 Z"
            fill="#f7d9d4" opacity="0.85" />
          {/* 右垂耳 */}
          <path d="M128 62 C154 78 166 118 156 152 C152 166 140 168 134 156 C124 136 120 96 118 72 Z"
            fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M130 76 C146 92 152 122 146 146 C144 154 138 155 135 147 C128 130 125 98 124 80 Z"
            fill="#f7d9d4" opacity="0.85" />
          {/* 脸蛋 */}
          <ellipse cx="90" cy="96" rx="46" ry="42" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" />
          {/* 头顶小呆毛 */}
          <path d="M84 56 C84 48 88 44 90 40 C92 44 96 48 96 56" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* 腮红 */}
          <ellipse cx="62" cy="106" rx="9" ry="6" fill="#f2b8b0" opacity="0.7" />
          <ellipse cx="118" cy="106" rx="9" ry="6" fill="#f2b8b0" opacity="0.7" />
          {/* 闭眼（>< 没办法了的感觉） */}
          <path d="M66 92 l7 5 m0 -5 l-7 5" stroke="#8a7d6b" strokeWidth="3" strokeLinecap="round" />
          <path d="M107 92 l7 5 m0 -5 l-7 5" stroke="#8a7d6b" strokeWidth="3" strokeLinecap="round" />
          {/* 鼻子 + 无奈的嘴 */}
          <path d="M87 102 h6 l-3 4 z" fill="#e8a89f" />
          <path d="M90 106 q-4 6 -9 5 M90 106 q4 6 9 5" stroke="#8a7d6b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* 摊手（两个小爪子往两边一摊） */}
          <path d="M40 130 q-10 4 -12 12" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="27" cy="144" r="7" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" />
          <path d="M140 130 q10 4 12 12" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="153" cy="144" r="7" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" />
        </g>
      </svg>
    </div>
  )
}

// 访客 30 分钟限时门禁：分享链接带 s=1 进入时开始计时，到期整页替换为送客兔
export default function ShareGate({ children }) {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const isGuest = new URLSearchParams(window.location.search).get('s') === '1'
    if (!isGuest) return
    let until = 0
    try { until = +localStorage.getItem(KEY) || 0 } catch { /* ignore */ }
    if (!until) {
      until = Date.now() + MINUTES * 60 * 1000
      try { localStorage.setItem(KEY, String(until)) } catch { /* ignore */ }
    }
    const left = until - Date.now()
    if (left <= 0) { setExpired(true); return }
    const t = setTimeout(() => setExpired(true), left)
    return () => clearTimeout(t)
  }, [])

  if (!expired) return children

  return (
    <div className="fixed inset-0 z-[80] flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <LopRabbit />
      <h2 className="font-display mt-6 text-[22px] font-bold text-stone-800 sm:text-[26px]">
        你已经看了 30 分钟啦
      </h2>
      <p className="mt-2 text-[14px] leading-7 text-stone-500">
        我家主人叫我回去啦，没办法咯～
      </p>
      <p className="mt-6 max-w-xs text-[12px] leading-5 text-stone-400">
        想继续挑小城的话，找分享给你的人再要一张新的「入场券」吧
      </p>
    </div>
  )
}
