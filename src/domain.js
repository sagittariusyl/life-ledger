import { format, isValid, parse } from 'date-fns'

export const categories = ['餐饮', '交通', '住房缴费', '日用百货', '购物', '医疗健康', '学习教育', '休闲娱乐', '旅行住宿', '通讯网络', '人情往来', '金融保险', '宠物', '工资补贴', '其他']
export const kinds = ['支出', '收入', '不计收支']
export const colors = ['#423e38', '#a6927b', '#c5b9a5', '#8d9690', '#b5a59c', '#7d7368', '#d0c8be', '#968b80', '#a59e8e', '#9daca5', '#bdafa3', '#8c8179', '#c0b6ab', '#a1a398', '#e3ded5']
// 关键词部分改编自 Narymax_AutoAccount，GPL-3.0；来源和许可见 README。
const defaults = [
  ['餐饮', '肯德基|麦当劳|星巴克|餐厅|饭店|咖啡|奶茶|火锅|外卖|早餐|午餐|晚餐|包子|油条|豆浆|馒头|炒饭|饺子|面条|盖饭|牛肉面|披萨|汉堡|寿司|烤串|沙拉'],
  ['交通', '中国石油|滴滴出行|共享单车|公交卡充值|地铁票|出租车费|加油|停车费|机票|火车票|地铁|公交|高铁|打车|出租车'],
  ['住房缴费', '水费|电费|煤气费|燃气费|房租|物业费|维修费|华润燃气'],
  ['日用百货', '卫生纸|洗发水|牙膏|洗衣液|沐浴露|日用品|超市|便利店'],
  ['购物', '衣服|帽子|鞋子|护肤品|彩妆|手链|项链|耳环|手机|电脑|电视|冰箱|洗衣机|沙发|服装|大润发'],
  ['医疗健康', '医院|药店|药品|体检|门诊|挂号'], ['学习教育', '学费|培训|课程|书籍|书店'],
  ['休闲娱乐', '电影|影院|演出|游戏|酒吧|视频会员|门票|景区|博物馆'], ['旅行住宿', '酒店|宾馆|民宿|旅馆|客栈'],
  ['通讯网络', '电话费|话费充值|网络费|宽带'], ['人情往来', '红包|礼金|礼物'], ['金融保险', '保险|保费|利息'], ['宠物', '宠物|猫粮|狗粮'], ['工资补贴', '工资|薪资|补贴'],
]
export const money = (cents) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)
export function parseCents(value) {
  const text = String(value ?? '').replace(/[¥￥,\s元]/g, '')
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(text)) throw new Error('金额格式无效')
  const amount = Math.round(Math.abs(Number(text)) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('金额须大于零')
  return amount
}
export function parseTime(value) {
  const text = String(value ?? '').trim().replace(/\//g, '-').replace('T', ' ')
  if (!/^\d{4}-\d{1,2}-\d{1,2}( \d{1,2}:\d{2}(:\d{2})?)?$/.test(text)) throw new Error('日期或时间格式无效')
  for (const pattern of ['yyyy-M-d HH:mm:ss', 'yyyy-M-d HH:mm', 'yyyy-M-d']) {
    const date = parse(text, pattern, new Date(2000, 0, 1))
    if (isValid(date)) return format(date, 'yyyy-MM-dd HH:mm:ss')
  }
  throw new Error('日期或时间格式无效')
}
export function classify(merchant, description, rules = [], originalCategory = '') {
  const text = `${merchant} ${description}`.toLowerCase()
  const rule = [...rules].sort((a, b) => Number(b.exact) - Number(a.exact) || (b.updatedAt || b.id || 0) - (a.updatedAt || a.id || 0)).find((r) => r.exact ? merchant.trim().toLowerCase() === r.keyword.toLowerCase() : text.includes(r.keyword.toLowerCase()))
  if (rule) return rule.category
  const match = (value) => defaults.find(([, words]) => new RegExp(words, 'i').test(value))?.[0]
  const sourceCategory = { '餐饮美食': '餐饮', '交通出行': '交通', '酒店旅游': '旅行住宿', '日用百货': '日用百货', '文化休闲': '休闲娱乐', '服饰装扮': '购物', '医疗健康': '医疗健康', '教育培训': '学习教育', '住房物业': '住房缴费', '通讯物流': '通讯网络', '人情往来': '人情往来', '金融保险': '金融保险', '工资收入': '工资补贴' }[originalCategory]
  return match(description) || sourceCategory || match(merchant) || '其他'
}
export function detectKind(type, direction, status, description) {
  if (/关闭|失败|撤销|未支付/.test(status)) return '跳过'
  if (/不计收支|中性/.test(direction)) return '不计收支'
  if (/支出/.test(direction)) return '支出'
  if (/收入/.test(direction)) return '收入'
  return '不计收支'
}
export const recordKind = (r) => r.kind === '退款' ? '收入' : r.kind
export const signedMoney = (r) => `${recordKind(r) === '收入' ? '＋' : recordKind(r) === '支出' ? '−' : ''}${money(r.amount)}`

export function prepareImport(records, existing) {
  const stored = new Map(existing.map((r) => [r.fingerprint || fingerprint(r), r]))
  const seen = new Set()
  return records.map((incoming) => {
    const key = fingerprint(incoming), previous = stored.get(key)
    const next = previous ? { ...previous, kind: incoming.kind, rawDirection: incoming.rawDirection, time: incoming.time, parserVersion: incoming.parserVersion, category: incoming.categoryManual ? incoming.category : previous.categoryManual || (previous.category && previous.category !== '其他') ? previous.category : incoming.category, categoryManual: incoming.categoryManual || previous.categoryManual } : { ...incoming, fingerprint: key }
    const fields = ['kind', 'rawDirection', 'time', 'category', 'categoryManual', 'parserVersion']
    const changes = previous ? fields.filter((field) => previous[field] !== next[field]) : []
    const action = seen.has(key) ? 'duplicate' : previous ? (changes.length ? 'update' : 'duplicate') : 'add'
    seen.add(key)
    return { record: next, previous, changes, action }
  })
}
export function fingerprint(record) {
  if (record.transactionId) return `${record.source}:id:${record.transactionId}`
  return JSON.stringify([record.source, record.time, record.amount, record.merchant, record.description, record.kind])
}
export function markDuplicates(records, existing) {
  const seen = new Set(existing.map((r) => r.fingerprint || fingerprint(r)))
  return records.map((r) => {
    const key = fingerprint(r), duplicate = seen.has(key)
    seen.add(key)
    return { ...r, fingerprint: key, duplicate }
  })
}
export function summarize(records) {
  let expense = 0, income = 0
  const byDay = {}, byCategory = {}, byMerchant = {}
  for (const r of records) {
    const kind = recordKind(r)
    if (!['支出', '收入'].includes(kind)) continue
    if (kind === '支出') expense += r.amount
    else income += r.amount
    const net = kind === '收入' ? -r.amount : r.amount
    const day = r.time.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + net
    byCategory[r.category] = (byCategory[r.category] || 0) + net
    byMerchant[r.merchant] = (byMerchant[r.merchant] || 0) + net
  }
  return { expense, income, net: expense - income, byDay, byCategory, byMerchant }
}

