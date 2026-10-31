// 租售比搜索解析测试：node 裸跑 ESM 时 JSON import 需 with 属性，
// 这里把 lib 复制到临时目录并补上属性后再 import（vite 构建无此限制）
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(root, 'scripts', '.tmp-payback')
mkdirSync(join(tmp, 'lib'), { recursive: true })
mkdirSync(join(tmp, 'data'), { recursive: true })

const fix = src => src.replace(/from '(\.\.?\/[^']*\.json)'/g, "from '$1' with { type: 'json' }")
for (const f of ['assistant.js', 'store.js', 'constants.js']) {
  writeFileSync(join(tmp, 'lib', f), fix(readFileSync(join(root, 'src/lib', f), 'utf8')))
}
writeFileSync(join(tmp, 'data', 'cities_full.json'), readFileSync(join(root, 'src/data/cities_full.json')))

const A = await import(join(tmp, 'lib', 'assistant.js'))
const S = await import(join(tmp, 'lib', 'store.js'))
const all = JSON.parse(readFileSync(join(root, 'src/data/cities_full.json'), 'utf8')).cities

const base = S.defaultFilters()
const cases = [
  '租售比少于20年', '回本期大于30年', '回本15年以内的地方',
  '云南 租售比少于18年', '回本快的小城', '取消回本',
  '租售比25年以上', '回本周期不超过22年',
]
for (const q of cases) {
  const r = A.interpret(q, base)
  if (r.kind !== 'plan') { console.log(q, '→', r.kind); continue }
  const n = S.applyFilters(all, r.next).length
  console.log(q, '→ max:', r.next.paybackMax, 'min:', r.next.paybackMin, '|', (r.items.find(i => i.k === 'payback') || {}).value || '-', '| 命中', n)
}

rmSync(tmp, { recursive: true, force: true })
