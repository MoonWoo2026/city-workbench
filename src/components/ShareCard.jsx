import { forwardRef } from 'react'
import dataset from '../data/cities_full.json'

// 分享卡片：离屏渲染后由 html-to-image 转 PNG（微信转发用）
const ShareCard = forwardRef(function ShareCard({ city, qr }, ref) {
  const pros = (city.pros || []).slice(0, 3)
  const tags = city.tags.slice(0, 5)
  return (
    <div ref={ref} className="w-[375px] bg-[#FAF9F6] p-5" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      {/* 品牌头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-[15px] font-bold text-white">躺</span>
          <div>
            <p className="text-[15px] font-bold leading-tight text-stone-900">去哪躺平</p>
            <p className="text-[10px] text-stone-400">全国低成本旅居城市数据库</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">{city.type}</span>
      </div>

      {/* 城市名 */}
      <div className="mt-4">
        <p className="text-[30px] font-bold leading-tight text-stone-900">{city.name}</p>
        <p className="mt-0.5 text-[12px] text-stone-500">
          {city.province}{city.parent ? ` · ${city.parent}` : ''} · {city.region}{city.clean50 ? ' · 50km 无重污染' : ''}
        </p>
      </div>

      {/* 价格三格 */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[['主卧合租', city.rent_shared], ['单人整租', city.rent_single], ['月总支出', city.monthly_total]].map(([label, v]) => (
          <div key={label} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-stone-200/70">
            <p className="text-[10px] text-stone-400">{label}</p>
            <p className="mt-0.5 text-[16px] font-bold text-stone-900">¥{v}<span className="text-[10px] font-normal text-stone-400">/月</span></p>
          </div>
        ))}
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600 ring-1 ring-stone-200/60">{t}</span>
          ))}
        </div>
      )}

      {/* 亮点 */}
      {pros.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200/70">
          <p className="text-[12px] font-semibold text-emerald-700">躺平亮点</p>
          <ul className="mt-1 space-y-1">
            {pros.map((p, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-[1.5] text-stone-600">
                <span className="mt-[5px] h-1 w-1 flex-none rounded-full bg-emerald-500" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 交通速览 */}
      {city.transit?.rail && (
        <p className="mt-2.5 text-[11px] leading-[1.5] text-stone-500">🚄 {city.transit.rail}</p>
      )}

      {/* 底部二维码 */}
      <div className="mt-3.5 flex items-center justify-between rounded-2xl bg-stone-900 px-3.5 py-3">
        <div>
          <p className="text-[12px] font-semibold text-white">扫码查看完整档案</p>
          <p className="mt-0.5 text-[10px] text-stone-400">{dataset.cities.length} 个城市/区县/小镇任你挑</p>
          <p className="mt-1 text-[10px] text-emerald-400">city-workbench.onrender.com</p>
        </div>
        {qr && <img src={qr} alt="二维码" className="h-16 w-16 rounded-lg bg-white p-1" />}
      </div>
    </div>
  )
})

export default ShareCard
