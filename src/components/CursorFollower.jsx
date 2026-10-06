import { useEffect, useRef, useState } from 'react'

// 躺平调性光标跟随：柔和光晕 + 一片 lag 飘动的叶子，仅桌面端（pointer:fine）启用
export default function CursorFollower() {
  const [enabled, setEnabled] = useState(false)
  const glowRef = useRef(null)
  const leafRef = useRef(null)

  useEffect(() => {
    // 仅精确指针（鼠标/触控板）启用；触屏设备不渲染
    if (!window.matchMedia('(pointer: fine)').matches) return
    setEnabled(true)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const glow = glowRef.current
    const leaf = leafRef.current
    if (!glow || !leaf) return

    let mx = -100, my = -100        // 鼠标位置
    let gx = -100, gy = -100        // 光晕（快跟随）
    let lx = -100, ly = -100        // 叶子（慢跟随）
    let rot = 0, raf = 0
    let idleTimer = 0, visible = false

    const onMove = e => {
      mx = e.clientX
      my = e.clientY
      if (!visible) {
        visible = true
        glow.style.opacity = '1'
        leaf.style.opacity = '1'
      }
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        visible = false
        glow.style.opacity = '0'
        leaf.style.opacity = '0'
      }, 4000) // 静置 4 秒后悄悄淡出
    }

    const tick = () => {
      // 光晕紧跟（0.22），叶子慵懒地拖在后面（0.06）
      gx += (mx - gx) * 0.22
      gy += (my - gy) * 0.22
      lx += (mx - lx) * 0.06
      ly += (my - ly) * 0.06
      // 叶子随水平移动方向轻微摇摆
      const vx = mx - lx
      const targetRot = Math.max(-24, Math.min(24, vx * 0.35))
      rot += (targetRot - rot) * 0.05

      glow.style.transform = `translate(${gx - 14}px, ${gy - 14}px)`
      leaf.style.transform = `translate(${lx - 9}px, ${ly - 22}px) rotate(${rot}deg)`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      clearTimeout(idleTimer)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      {/* 柔和光晕 */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[70] h-7 w-7 rounded-full opacity-0 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, rgba(16,122,87,0.16) 0%, rgba(16,122,87,0.05) 55%, transparent 70%)',
        }}
      />
      {/* 飘动的小叶子 */}
      <div
        ref={leafRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[70] opacity-0 transition-opacity duration-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 4C11 5 5 10 4 19c0 1 .6 1.6 1.5 1.2C14 19 19.5 13 20 4z"
            fill="rgba(22,122,79,0.35)"
            stroke="rgba(22,122,79,0.5)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path d="M6 18C9 13 13 9 18 6" stroke="rgba(22,122,79,0.45)" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </div>
    </>
  )
}
