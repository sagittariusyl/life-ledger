import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRows, readBill } from '../src/importers/index.js'
import * as XLSX from 'xlsx'
import { classify, markDuplicates, parseCents, parseTime, summarize } from '../src/domain.js'

const wechatHeaders = ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '当前状态', '交易单号']
test('微信：跳过说明行，保留精确时间，区分支出退款转账及失败', () => {
  const result = parseRows([['微信账单'], wechatHeaders,
    ['2026-10-01 12:34:56', '商户消费', '咖啡店', '拿铁', '支出', '¥28.50', '支付成功', 'a1'],
    ['2026-10-02 12:00:00', '商户消费退款', '咖啡店', '拿铁', '收入', '28.50', '退款成功', 'r1'],
    ['2026-10-02 13:00:00', '转账', '朋友', '餐费', '支出', '100', '支付成功', 't1'],
    ['2026-10-02 14:00:00', '商户消费', '商店', '商品', '支出', '20', '交易关闭', 'f1'],
  ])
  assert.deepEqual(result.records.map((r) => r.kind), ['支出', '收入', '支出'])
  assert.equal(result.records[0].amount, 2850)
  assert.equal(result.records[0].time, '2026-10-01 12:34:56')
  assert.equal(result.records[0].category, '餐饮')
  assert.equal(result.skipped, 1)
  assert.equal(summarize(result.records).net, 10000)
})
test('支付宝：已退款原始支出仍保留，异常行不静默丢弃', () => {
  const result = parseRows([['交易时间', '交易对方', '商品名称', '收/支', '金额（元）', '交易状态', '交易订单号'],
    ['2026/10/01 08:00', '城市酒店', '旅行住宿', '支出', '1,200.01', '退款成功', '123'],
    ['错误日期', '商店', '物品', '支出', '20', '交易成功', '456'],
  ])
  assert.equal(result.source, '支付宝')
  assert.equal(result.records[0].kind, '支出')
  assert.equal(result.records[0].amount, 120001)
  assert.equal(result.records[0].category, '旅行住宿')
  assert.equal(result.errors[0].row, 3)
})
test('商户精确规则优先，关键词不区分英文大小写', () => {
  const rules = [{ id: 1, keyword: 'COFFEE', category: '娱乐', exact: false }, { id: 2, keyword: 'coffee shop', category: '生活', exact: true }]
  assert.equal(classify('Coffee Shop', '咖啡', rules), '生活')
  assert.equal(classify('my coffee', '', rules), '娱乐')
})
test('去重覆盖同文件和历史账单，跨来源订单号独立', () => {
  const a = { source: 'wechat', transactionId: '1' }
  const result = markDuplicates([a, a, { source: 'alipay', transactionId: '1' }], [])
  assert.deepEqual(result.map((r) => r.duplicate), [false, true, false])
  assert.equal(markDuplicates([a], [result[0]])[0].duplicate, true)
  const b = { source: 'wechat', time: '2026-10-01 00:00:00', amount: 100, merchant: '店', description: '', kind: '支出' }
  assert.deepEqual(markDuplicates([b, b], []).map((r) => r.duplicate), [false, true])
})
test('金额和日期严格校验', () => {
  assert.throws(() => parseCents('未知'))
  assert.throws(() => parseCents('0'))
  assert.throws(() => parseCents('2.345'))
  assert.throws(() => parseTime('2026-02-30 10:00:00'))
  assert.equal(parseTime('2026-10-01T12:30'), '2026-10-01 12:30:00')
})
test('净消费按支出减收入计算，不计收支排除', () => {
  const base = { time: '2026-10-01 10:00:00', merchant: '店', category: '餐饮' }
  const result = summarize([{ ...base, kind: '支出', amount: 1000 }, { ...base, kind: '收入', amount: 1500 }, { ...base, kind: '不计收支', amount: 5000 }, { ...base, kind: '收入', amount: 8000 }])
  assert.equal(result.net, -8500)
  assert.equal(result.byCategory['餐饮'], -8500)
})
test('CSV 文件读取支持前言、引号内逗号与 BOM', async () => {
  const content = '\uFEFF微信账单\n' + wechatHeaders.join(',') + '\n2026-10-01 12:00:00,商户消费,咖啡店,"咖啡,蛋糕",支出,42.00,支付成功,id1'
  const bytes = new TextEncoder().encode(content)
  const result = await readBill({ name: 'bill.csv', arrayBuffer: async () => bytes.buffer }, [], 'auto')
  assert.equal(result.records[0].description, '咖啡,蛋糕')
  assert.equal(result.records[0].amount, 4200)
})
test('XLSX 文件读取可查找账单工作表，并保留 Excel 日期时间', async () => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['说明']]), '说明')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([wechatHeaders, [new Date(2026, 9, 1, 12, 34, 56), '商户消费', '地铁', '乘车', '支出', 3.2, '支付成功', 'x1']]), '账单')
  workbook.Sheets['账单'].A2 = { t: 'n', v: Date.UTC(2026, 9, 1, 12, 34, 56) / 86400000 + 25569, z: 'yyyy-mm-dd hh:mm:ss' }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const result = await readBill({ name: 'bill.xlsx', arrayBuffer: async () => bytes }, [], 'auto')
  assert.equal(result.records[0].time, '2026-10-01 12:34:56')
  assert.equal(result.records[0].amount, 320)
})

