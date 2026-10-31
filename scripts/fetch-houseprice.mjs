// 抓取 fangjia.com 全国城市二手房挂牌均价 → scripts/houseprice.json
// 用法: node scripts/fetch-houseprice.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

const html = await (await fetch('https://www.fangjia.com/zoushi', { headers: UA })).text()
const re = /<a name="([a-z]+)" href="https:\/\/([a-z]+)\.fangjia\.com\/zoushi">([^<]+)<\/a>/g
const cities = []
let m
while ((m = re.exec(html))) cities.push({ slug: m[2], name: m[3] })
console.log('城市数:', cities.length)

const out = {}
let done = 0, fail = []
const CONC = 8
async function one(c) {
  try {
    const h = await (await fetch(`https://${c.slug}.fangjia.com/zoushi`, { headers: UA })).text()
    const mm = h.match(/<em>(\d+)<\/em>\s*<label>本月均价/)
    if (mm) out[c.name] = +mm[1]
    else fail.push(c.name)
  } catch { fail.push(c.name) }
  if (++done % 50 === 0) console.log(done, '/', cities.length)
}
for (let i = 0; i < cities.length; i += CONC) {
  await Promise.all(cities.slice(i, i + CONC).map(one))
}
console.log('成功:', Object.keys(out).length, '失败:', fail.length, fail.slice(0, 20))

writeFileSync(join(dir, 'houseprice.json'), JSON.stringify({
  _comment: '全国城市二手房挂牌均价（元/㎡），key 为城市名（fangjia.com 口径，含「州/盟/地区」后缀）',
  source: '禧泰数据·中国房价行情 fangjia.com',
  updated: new Date().toISOString().slice(0, 10),
  cities: out,
}, null, 1))
