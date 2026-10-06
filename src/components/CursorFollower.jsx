import { useEffect, useRef, useState } from 'react'

// 躺平调性光标跟随：桌面端光晕 + 叶子拖尾；触屏手指划过瞬间也飘出小叶子
// 触屏用「叶子池」——手指移动时在指尖位置生成叶子，短暂停留后淡出消散
const MAX_LEAVES = 7

export default function CursorFollower() {
  const [isTouch, setIsTouch] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const glowRef = useRef(null)
  const leafRef = useRef(null)
  const poolRef = useRef(null) // 触屏叶子池容器

  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    setIsTouch(touch)
    setEnabled(true) // 两种设备都启用，触屏走叶子池分支
  }, [])

  // ---------- 桌面端：光晕 + 慵懒拖尾叶 ----------
  useEffect(() => {
    if (!enabled || isTouch) return
    const glow = glowRef.current
    const leaf = leafRef.current
    if (!glow || !leaf) return

    let mx = -100, my = -100
    let gx = -100, gy = -100
    let lx = -100, ly = -100
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
      }, 4000)
    }

    const tick = () => {
      gx += (mx - gx) * 0.22
      gy += (my - gy) * 0.22
      lx += (mx - lx) * 0.06
      ly += (my - ly) * 0.06
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
  }, [enabled, isTouch])

  // ---------- 触屏：指尖划过飘出叶子 ----------
  useEffect(() => {
    if (!enabled || !isTouch) return
    const pool = poolRef.current
    if (!pool) return

    let lastX = 0, lastY = 0, lastT = 0

    const spawn = (x, y, vx) => {
      // 池子满了就移除最旧的一片
      while (pool.childElementCount >= MAX_LEAVES) pool.firstChild.remove()
      const leaf = document.createElement('div')
      const size = 12 + Math.random() * 8 // 12~20px 大小不一
      const drift = (Math.random() - 0.5) * 30 // 左右随机漂移
      const spin = (Math.random() - 0.5) * 160 // 随机翻转
      leaf.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
        <path d="M20 4C11 5 5 10 4 19c0 1 .6 1.6 1.5 1.2C14 19 19.5 13 20 4z" fill="rgba(22,122,79,0.4)" stroke="rgba(22,122,79,0.55)" stroke-width="1" stroke-linejoin="round"/>
        <path d="M6 18C9 13 13 9 18 6" stroke="rgba(22,122,79,0.5)" stroke-width="1" stroke-linecap="round"/>
      </svg>`
      leaf.style.cssText = `position:fixed;left:0;top:0;z-index:70;pointer-events:none;
        transform:translate(${x - size / 2}px, ${y - size / 2}px) rotate(${spin * 0.2}deg);
        opacity:0.9;transition:transform 1.1s cubic-bezier(0.22,1,0.36,1),opacity 1.1s ease-out;`
      pool.appendChild(leaf)
      // 下一帧触发过渡：上飘 + 摇摆 + 淡出
      requestAnimationFrame(() => {
        leaf.style.transform = `translate(${x - size / 2 + drift}px, ${y - size / 2 - 26 - Math.abs(vx) * 0.15}px) rotate(${spin}deg)`
        leaf.style.opacity = '0'
      })
      setTimeout(() => leaf.remove(), 1200)
    }

    const onTouch = e => {
      const t = e.touches[0]
      if (!t) return
      const now = performance.now()
      const dx = t.clientX - lastX, dy = t.clientY - lastY
      const dist = Math.hypot(dx, dy)
      // 每移动 26px 或间隔 90ms 生成一片，避免一帧一片太密
      if (dist > 26 || now - lastT > 90) {
        spawn(t.clientX, t.clientY, dx)
        lastX = t.clientX; lastY = t.clientY; lastT = now
      }
    }
    const onTap = e => {
      const t = e.changedTouches[0]
      if (t) spawn(t.clientX, t.clientY, 0) // 轻点也飘一片
    }

    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchstart', onTap, { passive: true })
    return () => {
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTap)
    }
  }, [enabled, isTouch])

  if (!enabled) return null

  if (isTouch) {
    // 触屏只渲染叶子池容器
    return <div ref={poolRef} aria-hidden className="pointer-events-none fixed inset-0 z-[70]" />
  }

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
