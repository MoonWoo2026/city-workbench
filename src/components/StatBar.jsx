// 躺平调性头部：诗意横幅，数据自然融进文案，不再是仪表盘卡片
export default function StatBar({ total, matched, favCount, compareCount }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f2eee1] via-[#f7f5ef] to-[#edf1e7] px-6 py-8 ring-1 ring-stone-200/60 sm:px-10 sm:py-10">
      {/* 背景装饰大字 */}
      <span className="font-display pointer-events-none absolute -right-6 -top-12 select-none text-[190px] leading-none text-stone-900/[0.05]">
        慢
      </span>
      <p className="text-[11px] tracking-[0.35em] text-stone-400">低 成 本 旅 居 指 南</p>
      <h2 className="font-display mt-2.5 text-[30px] font-bold leading-snug text-stone-900 sm:text-[36px]">
        人间烟火气，最抚躺平人
      </h2>
      <p className="mt-3 max-w-xl text-[13px] leading-6 text-stone-500">
        林泉无俗物，此心安处是吾乡。不趋喧嚣，不困红尘，择一处安顿身心。
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-stone-500">
        <span><b className="font-semibold text-stone-800">{total}</b> 个旅居地</span>
        <span className="text-stone-300">·</span>
        <span><b className="font-semibold text-emerald-700">{matched}</b> 个合你口味</span>
        <span className="text-stone-300">·</span>
        <span>收藏 <b className="font-semibold text-rose-500">{favCount}</b></span>
        <span className="text-stone-300">·</span>
        <span>对比 <b className="font-semibold text-amber-600">{compareCount}</b></span>
      </div>
    </section>
  )
}
