// 躺平小助手：自然语言指令 → 筛选条件（纯本地识别，无需联网）
// 支持：省份/大区、租金预算、气候标签、居住类型、空气、大学城、排序、重置、撤销、收藏
import dataset from '../data/cities_full.json'
import { applyFilters, splitBudget } from './store.js'
import { PREF_RANK } from './constants.js'

const ALL_CITIES = dataset.cities
const SPECS = dataset.specialties?.specs || {} // 复旦 2023 专科声誉榜：key → { name, alias, list }

// 房租档区间（整租典型价边界，用于自然语言预算映射）
const BANDS = [
  { key: 'under_1000', min: 0, max: 1000 },
  { key: '1000_1700', min: 1000, max: 1700 },
  { key: '1700_3000', min: 1700, max: 3000 },
  { key: '3000_5000', min: 3000, max: 5000 },
  { key: 'above_5000', min: 5000, max: Infinity },
]

// 大区 → 省份
const REGION_TO_PROVINCES = Object.fromEntries(
  dataset.regions.map(r => [r.region, r.provinces.map(p => p.province)]),
)

// 省份别名（单字简称易撞地名，用数据驱动的黑名单兜底）
const PROV_ALIASES = {
  北京: ['京'], 上海: ['沪'], 天津: ['津'], 重庆: ['渝'],
  四川: ['川', '蜀'], 云南: ['滇'], 贵州: ['黔'],
  陕西: ['陕', '秦'], 甘肃: ['甘', '陇'], 广西: ['桂'],
  西藏: ['藏'], 内蒙古: ['内蒙'],
}
// 单字简称在「外省城市名」里出现时，视为撞名，不当作省份
const ALIAS_DENY = {}
for (const [prov, aliases] of Object.entries(PROV_ALIASES)) {
  for (const a of aliases) {
    if (a.length !== 1) continue
    ALIAS_DENY[a] = new Set(
      ALL_CITIES.filter(c => c.province !== prov && c.name.includes(a)).map(c => c.name),
    )
  }
}

// 城市/区县名（长名优先；与省份同名的跳过——北京/上海等由省份规则处理）
const CITY_NAMES = [...new Set(ALL_CITIES.map(c => c.name))]
  .filter(n => n.length >= 2 && !REGION_TO_PROVINCES[n] && !Object.values(REGION_TO_PROVINCES).flat().includes(n))
  .sort((a, b) => b.length - a.length)
const PINYIN_SET = new Set(ALL_CITIES.map(c => c.pinyin).filter(p => p && p.length >= 4))

const TAG_RULES = [
  { key: '天然温泉', words: ['温泉', '泡汤', '热海', '汤泉', '疗养', '养生', '泡温泉'] },
  { key: '海滨沿海', words: ['海边', '海滨', '沿海', '滨海', '海景', '看海', '大海', '海岛', '近海', '赶海', '海钓', '靠海', '是否靠海', '是否沿海', '沿海省份', '沿海城市'] },
  { key: '高原避暑', words: ['避暑', '凉快', '凉爽', '不热', '不闷热', '高原', '夏天舒服', '夏凉', '无酷暑', '清凉'] },
  { key: '南方湿润', words: ['湿润', '潮湿', '江南', '水乡', '梅雨', '不干燥', '南方', '空气湿润'] },
  { key: '北方干燥', words: ['干燥', '干爽', '不潮湿', '怕潮', '北方', '空气干燥'] },
  { key: '供暖充沛', words: ['暖气', '供暖', '集中供', '取暖', '有暖', '有暖气', '有地暖', '有集中供暖'] },
]

const TYPE_RULES = [
  { codes: ['B', 'C'], words: ['郊区', '市郊', '卫星城', '城郊'] },
  { codes: ['E'], words: ['县城', '小镇', '小城', '乡镇', '镇上', '村镇', '古镇', '县镇', '乡'] },
  { codes: ['D'], words: ['三四线城市', '三线城市', '四线城市', '五线城市', '三四线', '四五线', '三线', '四线', '五线', '地级市', '中小城市'] },
  { codes: ['A'], words: ['一二线城市', '一线城市', '二线城市', '一二线', '一线', '二线', '大城市', '省会', '大都市', '都市圈', '发达城市'] },
]

const WARM_PROVINCES = ['海南', '云南', '广西', '广东', '福建']

// 生活偏好规则：识别关键词 → 影响推荐排序打分（PREF_RANK）
const PREF_RULES = [
  { id: 'rail', label: '优先通高铁/动车的城市', words: /通高铁|有高铁|高铁方便|动车|高铁站|火车方便/ },
  { id: 'air', label: '优先有机场的城市', words: /有机场|飞机方便|能坐飞机|通航|坐飞机方便/ },
  { id: 'taxi', label: '优先打车/出行方便的城市', words: /打车方便|网约车|出租车多|出行方便|交通便利/ },
  { id: 'nomad', label: '优先数字游民友好城市', words: /远程办公|数字游民|自由职业|共享办公|工位|咖啡馆多|咖啡多|网速好|网络好/ },
  { id: 'quiet', label: '优先安静、慢节奏的小城', words: /安静|清静|不吵|没噪音|宁静|安逸|闲适|慢节奏|慢生活|悠闲|悠哉|养老|退休|隐居|避世|远离人群|人少|不拥挤|小众|冷门/ },
  { id: 'nature', label: '优先自然风光好的城市', words: /有山有水|山水|风景好|景色好|自然风光|美景|森林|氧吧|负氧离子|绿化好|公园多|湖边|江边|草原|星空|看星星/ },
  { id: 'mild', label: '优先气候温和的城市', words: /四季如春|冬暖夏凉|不冷不热|常年温和|气候宜人/ },
  { id: 'sun', label: '优先日照充足的城市', words: /阳光充足|日照多|晴天多|晒太阳|阳光好/ },
  { id: 'delivery', label: '优先快递便利的城市', words: /包邮|快递方便|次日达|快递多/ },
  { id: 'food', label: '优先餐饮/外卖丰富的城市', words: /外卖多|能点外卖|餐饮丰富|美食多|好吃|吃货|夜生活|夜市/ },
  { id: 'medical', label: '优先医疗资源较好的城市', words: /医疗好|医院近|有三甲|三甲医院|看病方便|医疗资源丰富|医疗条件|医院多|大医院/ },
  { id: 'safety', label: '优先治安良好的城市', words: /治安好|晚上能出门|安全感/ },
]

// 偏好打分规则 PREF_RANK 已集中到 constants.js（与筛选面板、主列表排序共用）

export const SUGGESTIONS = [
  '云南 1500 以下有温泉的县城',
  '每月预算2500能去哪躺平',
  '海边空气好的小城市',
  '过冬暖和又便宜的地方',
  '东北有暖气的地方',
  '安静慢节奏的小城',
  '有高铁、气候温和的三线城市',
  '数字游民友好的南方县城',
  '胃不好，去哪些城市看病强',
]

// ---------- 文本预处理 ----------
function normalize(raw) {
  return raw
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .trim()
}

// 关键词前若干字内是否有否定/排除语气
function isNegated(text, word, look = 6) {
  const i = text.indexOf(word)
  if (i < 0) return false
  const before = text.slice(Math.max(0, i - look), i)
  return /不要|不用|不看|不考虑|排除|去掉|除了|别去|别选|不想去|取消|非/.test(before)
}

function findProvinces(text) {
  const found = new Set()
  const deniedAlias = new Set()
  for (const prov of Object.values(REGION_TO_PROVINCES).flat()) {
    if (text.includes(prov)) found.add(prov)
  }
  for (const [prov, aliases] of Object.entries(PROV_ALIASES)) {
    for (const a of aliases) {
      if (!text.includes(a)) continue
      if (a.length === 1 && [...(ALIAS_DENY[a] || [])].some(name => text.includes(name))) {
        deniedAlias.add(a)
        continue
      }
      found.add(prov)
    }
  }
  return [...found]
}

function findRegions(text) {
  const hits = []
  for (const r of Object.keys(REGION_TO_PROVINCES)) {
    if (text.includes(r)) hits.push(r)
  }
  if (/东三省|东北三省/.test(text)) hits.push('东北')
  return [...new Set(hits)]
}

function findCity(text, raw) {
  for (const name of CITY_NAMES) {
    if (text.includes(name)) {
      const c = ALL_CITIES.find(x => x.name === name)
      return { name, province: c.province }
    }
  }
  // 拼音（按非字母切词，整词匹配）
  const tokens = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  for (const t of tokens) {
    if (PINYIN_SET.has(t)) {
      const c = ALL_CITIES.find(x => x.pinyin === t)
      return { name: c.name, province: c.province }
    }
  }
  return null
}

// 预算 → 租金档
function findLevels(text) {
  const num = '(\\d{3,5})'
  // 区间：1000到2000 / 1500-2500
  let m = text.match(new RegExp(num + '(?:元|块|米)?(?:到|至|~|-|—|–|—)' + num))
  if (m) {
    const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2])
    return {
      keys: BANDS.filter(x => x.min < b && x.max > a).map(x => x.key),
      label: `月租 ${a}–${b} 元`,
    }
  }
  // 以上
  m = text.match(new RegExp(num + '(?:元|块|米)?(?:以上|及以上|往上|不低于|高于|大于|≥|>=)'))
  if (m) {
    const v = +m[1]
    return { keys: BANDS.filter(x => x.max >= v).map(x => x.key), label: `月租 ${v} 元以上` }
  }
  // 以下 / 以内 / 预算
  m = text.match(new RegExp(num + '(?:元|块|米)?(?:以下|以内|之内|以内|不超过|不高于|低于|小于|≤|<=|上下)'))
    || text.match(new RegExp('(?:预算|月租|租金|房租|花费|价位|大概)\\s*' + num + '(?:元|块|米)?'))
  if (m) {
    const v = +m[1]
    return { keys: BANDS.filter(x => x.min <= v).map(x => x.key), label: `月租 ${v} 元以内` }
  }
  // 左右
  m = text.match(new RegExp(num + '(?:元|块|米)?(?:左右|附近|上下)'))
  if (m) {
    const v = +m[1]
    return {
      keys: BANDS.filter(x => x.min < v * 1.2 && x.max > v * 0.8).map(x => x.key),
      label: `月租 ${v} 元左右`,
    }
  }
  return null
}

function findTags(text) {
  const add = [], remove = []
  for (const rule of TAG_RULES) {
    const hit = rule.words.find(w => text.includes(w))
    if (!hit) continue
    const i = text.indexOf(hit)
    // 后缀否定：「高原不要」「温泉城市不看」——否定词在词后（允许夹「城市/的/多」等填充字）也算否定
    const after = text.slice(i + hit.length, i + hit.length + 8)
    const negAfter = /^(?:的|城市|地方|地区|县城|型|类|多|较多|密集)*?(?:不要|不看|不用|不选|不想去|别去?|排除|去掉|取消)/.test(after)
    if (negAfter || isNegated(text, hit)) remove.push(rule.key)
    else add.push(rule.key)
  }
  return { add: [...new Set(add)], remove: [...new Set(remove)] }
}

function findTypes(text) {
  const add = new Set(), remove = new Set()
  for (const rule of TYPE_RULES) {
    const hit = rule.words.find(w => text.includes(w))
    if (!hit) continue
    const neg = isNegated(text, hit)
    for (const code of rule.codes) neg ? remove.add(code) : add.add(code)
  }
  return { add: [...add], remove: [...remove] }
}

const TYPE_LABEL = { A: '一二线城市', B: '一线郊区', C: '二线郊区', D: '三四线城市', E: '县城/小镇' }

// ---------- 主入口 ----------
// 返回 { kind: 'plan'|'reset'|'undo'|'fav'|'help'|'unknown', ... }
export function interpret(rawText, currentFilters, { favOnly = false } = {}) {
  const text = normalize(rawText)
  const rawLower = rawText.toLowerCase()
  if (!text) return { kind: 'unknown' }

  // 帮助
  if (/^(你好|您好|hi|hello|在吗|哈喽|嗨)/.test(text)
    || /帮助|怎么用|你会|能干|功能|指令|会什么|怎么说|教教我/.test(text)) {
    return { kind: 'help' }
  }
  // 撤销
  if (/撤销|回退|上一步|返回上一|退回去|刚才的/.test(text)) return { kind: 'undo' }
  // 重置
  if (/重置|重新开始|重新筛选|清空条件|清除条件|恢复默认|全部城市|所有城市|看全部|全国都看|不筛选|全部重来/.test(text)) {
    return { kind: 'reset' }
  }
  // 收藏
  if (/只看收藏|我的收藏|收藏夹|收藏的(?:城市|地方)/.test(text)) {
    return { kind: 'fav', favOnly: true }
  }
  if (/看全部(?:城市|地方|结果)?|不看收藏/.test(text) && favOnly) {
    return { kind: 'fav', favOnly: false }
  }

  const next = {
    ...currentFilters,
    provinces: [...currentFilters.provinces],
    levels: [...currentFilters.levels],
    types: [...currentFilters.types],
    tags: [...currentFilters.tags],
    tagExcl: [...(currentFilters.tagExcl || [])],
    cityOnly: [...(currentFilters.cityOnly || [])],
    prefs: [...(currentFilters.prefs || [])],
  }
  const items = [] // 识别到的条件（用于回复气泡展示）
  const additive = /也|还|再加|加上|另外|同时|顺便/.test(text)

  // 0.5) 城市白名单：「除了南昌九江其他江西的不要」「江西除了南昌和九江都不要」= 只看这些城市（含下辖县/区）
  let cityOnlyHit = null
  const mExcept = text.match(/除了(.+?)(?:其他|其它|剩下|别|都)/)
  if (mExcept && /不要|不看|不去|别去|排除|去掉/.test(text)) {
    const names = []
    for (const name of CITY_NAMES) { // CITY_NAMES 已按长度降序，长名先占位（南昌县 先于 南昌）
      if (mExcept[1].includes(name) && !names.some(n => n.includes(name))) names.push(name)
    }
    if (names.length) {
      cityOnlyHit = names
      Object.assign(next, {
        cityOnly: names,
        provinces: [],
        levels: BANDS.map(b => b.key),
        types: [],
        tags: [],
        cleanOnly: false,
        uniOnly: false,
        spec: null,
        q: '',
      })
      items.push({ k: 'cityOnly', label: '只看城市', value: `${names.join('、')}（含下辖县/区）` })
    }
  }

  // 1) 大区
  const regions = cityOnlyHit ? [] : findRegions(text)
  let provinces = []
  if (regions.length) {
    provinces = [...new Set(regions.flatMap(r => REGION_TO_PROVINCES[r] || []))]
    items.push({ k: 'region', label: '大区', value: regions.join('、') })
  }

  // 2) 省份（叠加在大区之上）
  const provHits = cityOnlyHit ? [] : findProvinces(text)
  if (provHits.length) {
    provinces = [...new Set([...provinces, ...provHits])]
    if (!regions.length) items.push({ k: 'provinces', label: '省份', value: provHits.join('、') })
  }

  // 3) 暖冬地区（无显式省份/大区时才整体替换为暖冬省份群）
  if (!provinces.length && /过冬|暖冬|冬天暖和|冬天不冷|怕冷|避寒|猫冬|越冬/.test(text)) {
    provinces = [...WARM_PROVINCES]
    items.push({ k: 'warm', label: '暖冬地区', value: WARM_PROVINCES.join('、') })
  }
  if (provinces.length) {
    // 否定省份：不要/不看 X
    const neg = /(?:不要|不用|不看|不考虑|排除|去掉|除了|别去)([一-龥]{2,4}?)(?:省|市|自治区|$)/.exec(text)
    if (neg) {
      const negProv = findProvinces(neg[1])
      provinces = provinces.filter(p => !negProv.includes(p))
    }
    next.provinces = additive
      ? [...new Set([...next.provinces, ...provinces])]
      : provinces
  }

  // 4) 具体城市/区县名（点名某个地方 = 纯名称搜索，清掉其他维度以免被默认条件挡住）
  const city = cityOnlyHit ? null : findCity(text, rawLower)
  if (city) {
    Object.assign(next, {
      provinces: [],
      levels: BANDS.map(b => b.key),
      types: [],
      tags: [],
      cleanOnly: false,
      uniOnly: false,
      spec: null, // 点名城市时退出专科强院模式
      q: city.name,
    })
    items.push({ k: 'q', label: '搜索', value: city.name })
  } else {
    next.q = '' // 换话题时清掉旧的城市搜索
  }

  // 4.5) 月总预算模式：「预算3000」「每月花2500」「一个月2000生活费」（区别于「房租1500」单项）
  const budgetM = text.match(/(?:预算|生活费|总开销|月支出|月花费|每月(?:花|开销|支出)|一个月(?:花|开销|支出))(\d{3,5})/)
    || text.match(/(\d{3,5})(?:元|块)?(?:一个月|每月)(?:的)?(?:预算|生活费|开销|支出|花费)/)
  if (budgetM && +budgetM[1] >= 800) {
    const total = +budgetM[1]
    const mode = /合租|主卧|床位/.test(text) ? 'shared' : 'single'
    next.budget = { mode, ...splitBudget(total) }
    next.levels = BANDS.map(b => b.key) // 预算模式放开房租档
    items.push({ k: 'budget', label: '月预算', value: `¥${total}（${mode === 'shared' ? '合租' : '整租'}口径）` })
  } else if (/不限预算|取消预算|关掉预算|不看预算/.test(text)) {
    next.budget = null
    items.push({ k: 'budgetOff', label: '预算', value: '已关闭预算模式' })
  }

  // 5) 租金预算
  const lv = findLevels(text)
  let levelTouched = false
  if (lv) {
    next.levels = lv.keys
    items.push({ k: 'levels', label: '租金', value: lv.label })
    levelTouched = true
  } else if (/越便宜|最便宜|最低价|最省钱|最划算|便宜|划算/.test(text)) {
    next.levels = ['under_1000', '1000_1700', '1700_3000']
    items.push({ k: 'levels', label: '租金', value: '优先便宜档位' })
    levelTouched = true
  }
  // 换到新地域/新偏好时的租金档处理：在标签/类型解析后统一判断（见下）

  // 6) 标签（新一轮未说「也/还」时替换旧标签，避免跨话题 AND 残留）
  const tags = findTags(text)
  if (tags.remove.length) {
    if (/取消|撤销/.test(text)) {
      // 「取消高原」= 撤回之前的限定/排除，双向都清掉
      next.tags = next.tags.filter(t => !tags.remove.includes(t))
      next.tagExcl = next.tagExcl.filter(t => !tags.remove.includes(t))
      items.push({ k: 'tagReset', label: '标签', value: `${tags.remove.join('、')}不限` })
    } else {
      // 「高原不要」「排除高原」= 硬排除带该标签的城市
      next.tags = next.tags.filter(t => !tags.remove.includes(t))
      next.tagExcl = [...new Set([...next.tagExcl, ...tags.remove])]
      items.push({ k: 'tagOff', label: '排除标签', value: tags.remove.join('、') })
    }
  }
  if (tags.add.length) {
    next.tags = additive
      ? [...new Set([...next.tags, ...tags.add])]
      : tags.add
    // 正向限定与旧排除互斥
    next.tagExcl = next.tagExcl.filter(t => !tags.add.includes(t))
    for (const t of tags.add) items.push({ k: 'tag', label: '标签', value: t })
  }

  // 7) 居住类型
  const types = findTypes(text)
  if (types.remove.length) {
    next.types = next.types.filter(c => !types.remove.includes(c))
    items.push({ k: 'typeOff', label: '移除类型', value: types.remove.map(c => TYPE_LABEL[c]).join('、') })
  }
  if (types.add.length) {
    next.types = additive
      ? [...new Set([...next.types, ...types.add])]
      : types.add
    items.push({ k: 'types', label: '类型', value: types.add.map(c => TYPE_LABEL[c]).join('、') })
  }

  // 7.5) 换到新地域/新偏好且本轮没提预算 = 租金不限制（避免上一轮预算档残留导致零结果）
  if (!levelTouched && !additive
      && (provinces.length || city || tags.add.length || types.add.length)) {
    next.levels = BANDS.map(b => b.key)
  }

  // 8) 空气
  if (/不限(?:制)?(?:空气|环境)|空气(?:无所谓|都行|不限)/.test(text)) {
    next.cleanOnly = false
    items.push({ k: 'clean', label: '空气', value: '不限' })
  } else if (/空气(?:好|清新|新鲜|质量好|干净)|无污染|没污染|远离污染|生态好|环境好|蓝天白云|天空蓝/.test(text)) {
    next.cleanOnly = true
    items.push({ k: 'clean', label: '空气', value: '仅 50km 内无重污染' })
  }

  // 8.5) 排除工业/污染：「重工业不要」「不要工业城市」「污染不要」→ 只看 50km 无重污染
  const IND_WORD = /重工业|工业区|工业城市|工业|污染|雾霾|工厂多|工厂|厂矿|化工|烟囱/
  const indM = text.match(IND_WORD)
  if (indM) {
    const i = text.indexOf(indM[0])
    const before = text.slice(Math.max(0, i - 6), i)
    const after = text.slice(i + indM[0].length, i + indM[0].length + 8)
    const neg = /不要|不用|不看|不考虑|排除|去掉|除了|别去|别选|不想去|非/.test(before)
      || /^(?:的|城市|地方|地区|县城|型|类|多|较多|密集)*?(?:不要|不看|不用|不选|不想去|别去?|排除|去掉|取消)/.test(after)
    if (neg && !next.cleanOnly) {
      next.cleanOnly = true
      items.push({ k: 'clean', label: '空气', value: '排除周边有工业的城市' })
    }
  }

  // 8.6) 生活成本/物价
  if (/物价低|消费低|生活成本低|吃饭便宜|菜价便宜|日常开销低/.test(text)) {
    next.sort = 'total'
    items.push({ k: 'sort', label: '倾向', value: '优先月总支出低的' })
  }

  // 8.7) 三甲医院硬过滤：「有三甲的城市」= 只看有三甲；「不要三甲」= 排除有三甲
  const MED_WORD = /三甲|大医院|好医院/
  if (MED_WORD.test(text)) {
    const i = text.search(MED_WORD)
    const before = text.slice(Math.max(0, i - 6), i)
    const neg = /不要|不用|不看|排除|去掉|别去|无需|不需要|没有|没/.test(before)
    next.medOnly = !neg
    next.medExcl = neg
    items.push({ k: 'med', label: '医疗', value: neg ? '排除有三甲的城市' : '只看有三甲（本市或市区）' })
  }
  if (/取消三甲|不限三甲|三甲无所谓|三甲都行/.test(text)) {
    next.medOnly = false
    next.medExcl = false
    items.push({ k: 'medOff', label: '医疗', value: '三甲不限' })
  }

  // 8.8) 看病需求：疾病口语词 → 复旦专科声誉榜强院城市（硬过滤，全国排名靠前在前）
  if (/取消专科|不限专科|看病不限|取消看病|不看专科/.test(text)) {
    next.spec = null
    items.push({ k: 'specOff', label: '看病', value: '不限专科' })
  } else {
    let specHit = null, specWord = ''
    const lt = text.toLowerCase()
    outer: for (const [key, s] of Object.entries(SPECS)) {
      const words = [...(s.alias || []), s.name].sort((a, b) => b.length - a.length)
      for (const w of words) {
        if (lt.includes(w.toLowerCase())) { specHit = { key, s }; specWord = w; break outer }
      }
    }
    if (specHit) {
      if (isNegated(text, specWord)) {
        next.spec = null
        items.push({ k: 'specOff', label: '看病', value: '不限专科' })
      } else {
        next.spec = specHit.key
        next.q = '' // 疾病词不作关键词二次过滤
        items.push({ k: 'spec', label: '看病需求', value: `${specHit.s.name}强院城市（复旦榜）` })
        const top3 = specHit.s.list.slice(0, 3).map(h => `${h.short}${h.leader ? `·${h.leader.name}` : ''}（${h.city}）`).join('、')
        items.push({ k: 'specTop', label: '全国前列', value: top3 })
      }
    }
  }

  // 8.6) 生活偏好（影响推荐排序打分，不改筛选）
  const prefHits = PREF_RULES.filter(r => r.words.test(text))
  if (prefHits.length) {
    next.prefs = additive
      ? [...new Set([...(next.prefs || []), ...prefHits.map(r => r.id)])]
      : prefHits.map(r => r.id)
    for (const r of prefHits) items.push({ k: 'pref', label: '偏好', value: r.label })
  }
  // 「安静/养老/慢节奏」额外把大城市排除掉
  if (prefHits.some(r => r.id === 'quiet')) {
    next.types = (next.types.length ? next.types : ['A','B','C','D','E']).filter(t => t !== 'A')
  }

  // 9) 大学城
  if (/大学城|高校|大学周边|学院(?:附近|周边)/.test(text)) {
    const off = isNegated(text, '大学城') || /不限|不要|不用|去掉|所有区域|全部都看/.test(text)
    next.uniOnly = !off
    items.push({ k: 'uni', label: '大学城', value: off ? '不限' : '优先大学城周边' })
  }

  // 10) 排序
  const sortWords = /越便宜|最便宜|最省钱|最低价|按价格|按租金|按房租|按月总支出|价格从低到高|从便宜到贵|按名字|名称排序/.source
  if (new RegExp(sortWords).test(text)) {
    if (/合租|主卧|床位/.test(text)) { next.sort = 'shared'; items.push({ k: 'sort', label: '排序', value: '合租价格从低到高' }) }
    else if (/整租|单租|单间|房租|租金|房价|按价格|按租金/.test(text)) { next.sort = 'single'; items.push({ k: 'sort', label: '排序', value: '整租价格从低到高' }) }
    else if (/名字|名称/.test(text)) { next.sort = 'name'; items.push({ k: 'sort', label: '排序', value: '城市名称 A-Z' }) }
    else { next.sort = 'total'; items.push({ k: 'sort', label: '排序', value: '月总支出从低到高' }) }
  }

  if (!items.length) return { kind: 'unknown', raw: rawText }

  // 零结果自动放宽（按「隐藏默认条件 → 地域 → 明确偏好 → 预算」顺序，尽量保住用户显式意图）
  const calc = () => applyFilters(ALL_CITIES, next, { favs: null, favOnly: false }).length
  let count = calc()
  const relaxed = []
  const relaxSteps = [
    { when: () => next.uniOnly, run: () => { next.uniOnly = false; relaxed.push('已自动放宽「优先大学城」') } },
    { when: () => next.provinces.length > 0, run: () => { next.provinces = []; relaxed.push('限定省份没有匹配，已扩大到全国') } },
    { when: () => next.cleanOnly, run: () => { next.cleanOnly = false; relaxed.push('已自动放宽「空气」限制') } },
    { when: () => next.types.length > 0, run: () => { next.types = []; relaxed.push('已不限定城市类型') } },
    { when: () => next.tags.length > 0, run: () => { next.tags = []; relaxed.push('条件太多，已放宽气候标签') } },
    { when: () => next.tagExcl.length > 0, run: () => { next.tagExcl = []; relaxed.push('排除条件太苛刻，已取消标签排除') } },
    { when: () => !!next.spec, run: () => { next.spec = null; relaxed.push('该专科强院城市与其他条件无交集，已取消专科限制') } },
    { when: () => !!next.budget, run: () => { next.budget = null; relaxed.push('预算内没有完全住得起的，已关闭预算限制') } },
  ]
  for (const step of relaxSteps) {
    if (count > 0) break
    if (step.when()) { step.run(); count = calc() }
  }
  return { kind: 'plan', next, items, count, relaxed }
}

// ---------- 结果打分与推荐理由（用于「穷尽合集 + 最优选」回复） ----------
// 透明打分：用户显式条件命中加分多；空气好/大学城小幅加分；同分按总支出低优先
export function rankResults(matched, f) {
  const arr = matched.map(c => {
    let score = 0
    const why = []
    // 专科强院模式：全国排名越靠前分越高
    if (f.spec && SPECS[f.spec]) {
      const es = (c.spec || []).filter(s => s[0] === f.spec)
      if (es.length) {
        const r = Math.min(...es.map(s => s[1]))
        score += (11 - r) * 3
        why.push(`${SPECS[f.spec].name}全国第${r}`)
      }
    }
    for (const t of f.tags || []) if (c.tags.includes(t)) { score += 3; why.push(t) }
    if ((f.types || []).length && f.types.includes(c.type)) score += 1
    if (c.clean50) { score += 1; if (f.cleanOnly) why.push('50km 无重污染') }
    if (f.uniOnly && c.uni_town) { score += 1; why.push('大学城周边') }
    for (const p of f.prefs || []) {
      const r = PREF_RANK[p]?.(c)
      if (r) { score += r[0]; why.push(r[1]) }
    }
    return { c, score, why }
  })
  arr.sort((a, b) => b.score - a.score || a.c.monthly_total - b.c.monthly_total)
  return arr.map(({ c, score, why }) => ({ city: c, score, why, reason: reasonOf(c, why) }))
}

function reasonOf(c, why) {
  const parts = []
  if (why.length) parts.push(`命中偏好：${why.join('、')}`)
  parts.push(`整租 ¥${c.rent_single}/月、月总支出约 ¥${c.monthly_total}`)
  if (!why.includes('50km 无重污染') && c.clean50) parts.push('50km 无重污染')
  if (!why.length && c.uni_town) parts.push('大学城周边')
  return parts.join('；')
}

// ---------- 结果微调（微调条专用）：在现有筛选上做排除/限定，不重置其他维度 ----------
// 北方 = 秦岭淮河以北常见口径；南方 = 其余省份（不含港澳台）
const NORTH = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','山东','河南','陕西','甘肃','青海','宁夏','新疆']
const SOUTH = ['上海','江苏','浙江','安徽','福建','江西','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏']

function addExcl(filters, label, provinces) {
  const excl = [...(filters.excl || [])].filter(e => e.label !== label)
  excl.push({ label, provinces })
  return { ...filters, excl }
}

// 返回 { next, chip } 或 null（识别不了就返回 null，让前端提示换个说法）
export function refineInterpret(rawText, currentFilters) {
  const text = normalize(rawText)
  if (!text) return null

  // 撤销微调：把所有排除项清掉
  if (/取消|撤销|清除|删掉|去掉所有|全部取消/.test(text) && /排除|微调|限制/.test(text)) {
    return { next: { ...currentFilters, excl: [] }, chip: null }
  }

  // 排除 X
  const mEx = text.match(/(?:排除|不要|去掉|不看|滤掉|踢掉|别去|剔除|屏蔽)(.+)$/)
  if (mEx) {
    const raw = mEx[1].replace(/的|城市|地方|省份|们|都|全部|所有|了/g, '')
    if (/北方/.test(raw)) return { next: addExcl(currentFilters, '排除北方', NORTH), chip: '排除北方' }
    if (/南方/.test(raw)) return { next: addExcl(currentFilters, '排除南方', SOUTH), chip: '排除南方' }
    for (const [r, provs] of Object.entries(REGION_TO_PROVINCES)) {
      if (raw.includes(r)) return { next: addExcl(currentFilters, `排除${r}`, provs), chip: `排除${r}` }
    }
    const provs = findProvinces(raw)
    if (provs.length) return { next: addExcl(currentFilters, `排除${provs.join('、')}`, provs), chip: `排除${provs.join('、')}` }
    if (/三甲|大医院|好医院/.test(mEx[1])) {
      return { next: { ...currentFilters, medOnly: false, medExcl: true }, chip: '排除有三甲' }
    }
    if (/工业|污染|雾霾|厂/.test(mEx[1])) {
      return { next: { ...currentFilters, cleanOnly: true }, chip: '排除有工业' }
    }
    // 通用标签排除：「排除高原」「不要温泉」「去掉海边的」等
    const ft = findTags(raw)
    if (ft.add.length) {
      return {
        next: {
          ...currentFilters,
          tags: currentFilters.tags.filter(t => !ft.add.includes(t)),
          tagExcl: [...new Set([...(currentFilters.tagExcl || []), ...ft.add])],
        },
        chip: `排除${ft.add.join('、')}`,
      }
    }
    return null
  }

  // 只要 / 只看 X（限定）
  const mOnly = text.match(/(?:只要|只看|只留|仅要|就看)(.+)$/)
  if (mOnly) {
    const raw = mOnly[1].replace(/的|城市|地方|省份|们|都|全部|所有/g, '')
    if (/北方/.test(raw)) return { next: { ...currentFilters, provinces: [...NORTH], excl: [] }, chip: '只要北方' }
    if (/南方/.test(raw)) return { next: { ...currentFilters, provinces: [...SOUTH], excl: [] }, chip: '只要南方' }
    for (const [r, provs] of Object.entries(REGION_TO_PROVINCES)) {
      if (raw.includes(r)) return { next: { ...currentFilters, provinces: [...provs], excl: [] }, chip: `只要${r}` }
    }
    const provs = findProvinces(raw)
    if (provs.length) return { next: { ...currentFilters, provinces: provs, excl: [] }, chip: `只要${provs.join('、')}` }
    if (/三甲|大医院|好医院/.test(mOnly[1])) {
      return { next: { ...currentFilters, medOnly: true, medExcl: false }, chip: '只看有三甲' }
    }
    if (/县城|小镇/.test(raw)) return { next: { ...currentFilters, types: ['E'] }, chip: '只要县城/小镇' }
    // 通用标签限定：「只要高原」「只看温泉」「就看得暖气的」等
    const ft = findTags(raw)
    if (ft.add.length) {
      return {
        next: {
          ...currentFilters,
          tags: ft.add,
          tagExcl: (currentFilters.tagExcl || []).filter(t => !ft.add.includes(t)),
        },
        chip: `只要${ft.add.join('、')}`,
      }
    }
  }
  return null
}
