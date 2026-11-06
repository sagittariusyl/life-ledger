import Papa from 'papaparse'
import * as XLSX from 'xlsx/xlsx.mjs'
import { format } from 'date-fns'
import { alipay } from './alipay.js'
import { wechat } from './wechat.js'
import { classify, detectKind, parseCents, parseTime } from '../domain.js'

export const adapters = [alipay, wechat]
const clean = (value) => value instanceof Date ? format(value, 'yyyy-MM-dd HH:mm:ss') : String(value ?? '').replace(/^\uFEFF/, '').replace(/[\t\r\n]/g, '').trim()
function readField(row, headers, names) {
  const index = headers.findIndex((h) => names.includes(h))
  return index < 0 ? '' : clean(row[index])
}
export function parseRows(rows, rules = [], forcedSource = 'auto') {
  const headerIndex = rows.findIndex((row) => row.map(clean).some((v) => ['交易时间', '付款时间', '交易创建时间'].includes(v)) && row.map(clean).includes('交易对方'))
  if (headerIndex < 0) throw new Error('未找到账单表头，请使用支付宝或微信导出的原始账单文件。')
  const headers = rows[headerIndex].map(clean)
  const adapter = forcedSource === 'auto' ? adapters.find((a) => a.matches(headers)) : adapters.find((a) => a.id === forcedSource)
  if (!adapter) throw new Error('账单来源未识别，请手动选择支付宝或微信。')
  const missing = ['time', 'merchant', 'amount', 'direction'].filter((key) => !headers.some((h) => adapter.fields[key].includes(h)))
  if (missing.length) throw new Error(`缺少必要列：${missing.join('、')}，请检查账单来源。`)
  const records = [], errors = []
  let skipped = 0
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((v) => clean(v))) return
    const values = Object.fromEntries(Object.entries(adapter.fields).map(([key, names]) => [key, readField(row, headers, names)]))
    if (!values.time && (!values.amount || /合计|总计|说明|---/.test(row.map(clean).join(' ')))) return
    try {
      const kind = detectKind(values.type, values.direction, values.status, values.description)
      if (kind === '跳过') { skipped++; return }
      records.push({ source: adapter.id, transactionId: values.transactionId, time: parseTime(values.time), merchant: values.merchant || '未知商户', description: values.description, amount: parseCents(values.amount), kind, rawDirection: values.direction, parserVersion: 2, category: classify(values.merchant, values.description, rules, adapter.id === 'alipay' ? values.type : '') })
    } catch (error) { errors.push({ row: headerIndex + offset + 2, message: error.message }) }
  })
  return { records, errors, skipped, source: adapter.name }
}
export async function readBill(file, rules, source, encoding = 'auto') {
  const bytes = await file.arrayBuffer()
  let rows
  if (/\.csv$/i.test(file.name)) {
    let text
    if (encoding === 'auto') {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { text = new TextDecoder('gb18030').decode(bytes) }
    } else text = new TextDecoder(encoding).decode(bytes)
    const result = Papa.parse(text.replace(/\r\n?/g, '\n'), { skipEmptyLines: true, newline: '\n' })
    if (result.errors.some((e) => e.code === 'MissingQuotes')) throw new Error('CSV 引号格式损坏，请重新导出账单。')
    rows = result.data
  } else if (/\.xlsx?$/i.test(file.name)) {
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true })
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      for (const [key, cell] of Object.entries(sheet)) {
        if (key.startsWith('!') || cell.t !== 'n' || !XLSX.SSF.is_date(cell.z || '')) continue
        const serial = Math.round(cell.v * 86400) / 86400
        const d = XLSX.SSF.parse_date_code(serial, { date1904: !!workbook.Workbook?.WBProps?.date1904 })
        if (d) { cell.t = 's'; cell.v = `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')} ${String(d.H).padStart(2, '0')}:${String(d.M).padStart(2, '0')}:${String(d.S).padStart(2, '0')}`; delete cell.w }
      }
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
    })
    rows = sheets.find((sheet) => sheet.some((row) => row.map(clean).includes('交易对方')))
    if (!rows) throw new Error('Excel 中未找到有效账单工作表。')
  } else throw new Error('请选择 CSV、XLSX 或 XLS 文件。')
  return parseRows(rows, rules, source)
}
