// 注入房价：scripts/houseprice.json → src/data/cities_full.json
// 每城 c.house = { p, r1, r2, r3, back } + c.housetext；区县继承母城
// 用法: node scripts/build-houseprice.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(dir, '../src/data/cities_full.json'), 'utf8'))
const hp = JSON.parse(readFileSync(join(dir, 'houseprice.json'), 'utf8')).cities

// 名称归一化（与 build-fruits.mjs 一致）
const ETHNIC = /(维吾尔|柯尔克孜|哈萨克|塔吉克|景颇|蒙古|朝鲜|土家|哈尼|傈僳|布依|回|彝|藏|羌|白|傣|苗|侗|壮|黎|族)/g
const ADM = /(特别行政区|自治州|自治县|自治旗|地区|林区|盟|省|市|县|区|旗)$/
const base = s => (s || '').replace(ETHNIC, '').replace(ADM, '').trim()
const cands = s => {
  const t = base(s)
  return t.length > 2 && t.endsWith('州') ? [t, t.slice(0, -1)] : [t]
}
function parseParent(c) {
  const headRaw = (c.parent || '').split(/[·/]/)[0].trim()
  const m = headRaw.match(/^(.+?(?:自治州|地区|盟|州))((?:自治县|自治旗|县|市|区).*)?$/)
  if (m && m[2]) return { pref: m[1], rest: m[2] }
  return { pref: headRaw, rest: '' }
}

// 均价 key 索引：base 候选 → 价格
const priceByKey = {}
for (const [k, v] of Object.entries(hp)) for (const c of cands(k)) priceByKey[c] = v

// 户型面积段（㎡）
const AREA = { r1: [40, 60], r2: [70, 90], r3: [100, 130] }
const wan = x => Math.round(x / 10000)
function mkHouse(p, rent) {
  const h = { p }
  for (const [k, [a, b]] of Object.entries(AREA)) h[k] = [wan(p * a), wan(p * b)]
  // 回本期：一居室总价中值 ÷ 整租年租金（rent_single 为一居室月租）
  if (rent > 0) h.back = Math.round((p * 50) / (rent * 12) * 10) / 10
  return h
}

function lookup(c) {
  const keys = cands(c.name)
  // 根城市 / 省直辖县级市
  if (!c.parent || /省直辖|自治区直辖/.test(c.parent)) {
    const p = keys.map(k => priceByKey[k]).find(v => v != null)
    return p != null ? { p, inh: false } : null
  }
  // 区县继承母城
  const pk = cands(parseParent(c).pref)
  const p = pk.map(k => priceByKey[k]).find(v => v != null)
  return p != null ? { p, inh: true } : null
}

let root = 0, inh = 0
for (const c of data.cities) {
  delete c.house; delete c.housetext; delete c.houseInherited
  const r = lookup(c)
  if (!r) continue
  c.house = mkHouse(r.p, c.rent_single)
  if (r.inh) { c.houseInherited = true; inh++ } else root++
  const t = []
  t.push(`房价${r.p}元`, `${r.p}元/平`, `均价${r.p}`)
  t.push('房价', '买房', '购房', '均价', '房价多少', '租售比', '回本期', '上车')
  if (c.house.back) t.push(`${c.house.back}年回本`)
  if (r.p < 5000) t.push('低房价', '房价便宜', '白菜价房子', '几万买房', '低价买房')
  c.housetext = t.join(' ')
}
console.log(`房价注入：地级市/省直辖 ${root}，区县继承 ${inh}`)
writeFileSync(join(dir, '../src/data/cities_full.json'), JSON.stringify(data, null, 1))
