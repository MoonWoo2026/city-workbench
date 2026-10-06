import { useEffect, useState } from 'react'

const KEY = 'cw:guest-until'
const MINUTES = 30

// 躺平兔：四脚朝天躺着，肚子随呼吸起伏，小脚丫偶尔一翘，头顶飘 Zzz（纯 SVG + CSS 动画）
function LopRabbit() {
  return (
    <div className="rabbit-wrap">
      <svg width="220" height="170" viewBox="0 0 220 170" fill="none" aria-hidden>
        {/* 地面阴影 */}
        <ellipse cx="112" cy="142" rx="86" ry="10" fill="#e8e2d6" opacity="0.7" />
        {/* 垂耳：摊在地上 */}
        <path d="M52 84 C30 82 14 94 12 112 C11 124 20 130 30 124 C44 115 54 98 58 88 Z"
          fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M50 92 C36 92 26 102 25 114 C24 121 29 124 35 119 C44 112 50 100 53 94 Z"
          fill="#f7d9d4" opacity="0.85" />
        {/* 头（侧躺） */}
        <circle cx="72" cy="92" r="28" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" />
        {/* 头顶呆毛 */}
        <path d="M64 66 C62 58 65 53 66 49 C69 53 73 57 74 64" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* 腮红 + 安逸闭眼（弯弯的满足眼） */}
        <ellipse cx="60" cy="102" rx="7" ry="4.5" fill="#f2b8b0" opacity="0.7" />
        <path d="M58 88 q5 6 10 0" stroke="#8a7d6b" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M84 88 q5 6 10 0" stroke="#8a7d6b" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* 鼻子 + 微笑 */}
        <path d="M73 97 h6 l-3 4 z" fill="#e8a89f" />
        <path d="M76 101 q3 4 8 3" stroke="#8a7d6b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* 身体（躺平的大肚肚，随呼吸起伏） */}
        <g className="rabbit-belly">
          <ellipse cx="138" cy="106" rx="52" ry="30" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" />
          <ellipse cx="142" cy="110" rx="34" ry="20" fill="#faf6ee" />
        </g>
        {/* 小手手搭在肚子上 */}
        <ellipse cx="120" cy="98" rx="9" ry="6" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2" transform="rotate(-18 120 98)" />
        {/* 两只朝天小脚丫（右脚偶尔翘一下） */}
        <g className="rabbit-foot-l">
          <path d="M168 84 q-2 -16 4 -22" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <ellipse cx="174" cy="56" rx="8" ry="11" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" transform="rotate(14 174 56)" />
          <ellipse cx="175" cy="55" rx="4" ry="6" fill="#f7d9d4" opacity="0.8" transform="rotate(14 175 55)" />
        </g>
        <g className="rabbit-foot-r">
          <path d="M186 88 q4 -15 12 -19" stroke="#e3d5c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <ellipse cx="202" cy="64" rx="8" ry="11" fill="#f3ebe0" stroke="#e3d5c2" strokeWidth="2.5" transform="rotate(26 202 64)" />
          <ellipse cx="203" cy="63" rx="4" ry="6" fill="#f7d9d4" opacity="0.8" transform="rotate(26 203 63)" />
        </g>
        {/* 飘起来的 Zzz */}
        <g className="rabbit-zzz" fill="#c9bfae">
          <text className="zzz z1" x="46" y="46" fontSize="15" fontWeight="700">z</text>
          <text className="zzz z2" x="34" y="30" fontSize="19" fontWeight="700">z</text>
          <text className="zzz z3" x="20" y="10" fontSize="24" fontWeight="700">Z</text>
        </g>
      </svg>
    </div>
  )
}

// 访客 30 分钟限时门禁：分享链接带 s=1 进入时开始计时，到期整页替换为送客兔
// 每张入场券带 t= 时间戳；新券（t 更新）会重置 30 分钟，旧券/过期券直接送客
export default function ShareGate({ children }) {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isGuest = params.get('s') === '1'
    if (!isGuest) return
    const ticket = +params.get('t') || 0
    let state = null
    try {
      const raw = localStorage.getItem(KEY)
      state = raw ? (raw.startsWith('{') ? JSON.parse(raw) : { until: +raw, t: 0 }) : null
    } catch { /* ignore */ }
    // 无记录，或带来更新的入场券 → 发放/重置 30 分钟
    if (!state || ticket > (state.t || 0)) {
      state = { until: Date.now() + MINUTES * 60 * 1000, t: ticket }
      try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
    }
    const left = state.until - Date.now()
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
