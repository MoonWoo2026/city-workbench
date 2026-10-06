import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import ShareCard from './ShareCard.jsx'

// 城市分享：生成二维码 → 离屏渲染 ShareCard → toPng 转 PNG → 预览层（长按/保存转发微信）
// 用法：const shareCtl = useCityShare()；按钮调 shareCtl.start(city)，树里渲染 {shareCtl.node}
export function useCityShare() {
  // null=未触发；{ city, qr:null, img:null }=生成二维码中；{ city, qr, img:null }=渲染图片中；{ city, qr, img }=就绪
  const [share, setShare] = useState(null)
  const cardRef = useRef(null)

  const start = async city => {
    if (share) return
    setShare({ city, qr: null, img: null })
    try {
      const url = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(city.name)}&s=1&t=${Date.now()}`
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 128, color: { dark: '#1c1917', light: '#ffffff' } })
      setShare({ city, qr, img: null })
      await document.fonts.ready
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const img = await toPng(cardRef.current, { pixelRatio: 2.5, cacheBust: true })
      setShare({ city, qr, img })
    } catch {
      setShare(null)
    }
  }

  const close = useCallback(() => setShare(null), [])
  const loading = !!(share && !share.img)

  // 走 portal 挂到 body：卡片/弹窗祖先有 transform 时 fixed 定位会漂移，portal 可彻底规避
  const node = createPortal(
    <>
      {/* 离屏渲染的分享卡片（生成 PNG 用） */}
      {share && (
        <div style={{ position: 'fixed', left: -2000, top: 0, pointerEvents: 'none' }}>
          <ShareCard ref={cardRef} city={share.city} qr={share.qr} />
        </div>
      )}

      {/* 分享预览：生成后展示图片，长按/保存即可转发微信 */}
      {share && share.img && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px]" />
          <div
            className="animate-pop-in relative flex max-h-full w-full max-w-[400px] flex-col items-center gap-3 rounded-3xl bg-white p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img src={share.img} alt={`${share.city.name} 分享卡片`} className="max-h-[62vh] w-auto rounded-2xl ring-1 ring-stone-200" />
            <p className="text-center text-[12px] leading-[1.6] text-stone-500">
              微信里可<b className="text-stone-700">长按图片 → 发送给朋友</b><br />或先保存到相册再转发
            </p>
            <div className="flex w-full gap-2">
              <a
                href={share.img}
                download={`去哪躺平-${share.city.name}.png`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-emerald-700"
              >
                保存图片
              </a>
              <button
                onClick={close}
                className="flex-1 rounded-full bg-stone-100 px-4 py-2 text-[13px] font-medium text-stone-600 transition hover:bg-stone-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )

  return { start, close, loading, node }
}
