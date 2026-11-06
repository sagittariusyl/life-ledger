import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { X, Upload, ArrowRight } from 'lucide-react'
import { categories, kinds, classify, parseCents, parseTime, prepareImport, signedMoney, recordKind } from './domain.js'
import { readBill } from './importers/index.js'
import { db } from './db.js'

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} className={wide ? 'modal wide' : 'modal'} onCancel={(e) => { e.preventDefault(); onClose() }}><div className="modal-title"><h2>{title}</h2><button className="icon" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>{children}</dialog>
}
export function RecordDialog({ record, rules, onClose, onSave }) {
  const [form, setForm] = useState(record ? { ...record, kind: recordKind(record), amountText: String(record.amount / 100) } : { merchant: '', description: '', amountText: '', time: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"), kind: '支出', category: '其他', source: 'manual' })
  const [remember, setRemember] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try {
      const { amountText, ...data } = form
      await onSave({ ...data, merchant: data.merchant.trim(), description: data.description.trim(), amount: parseCents(amountText), time: parseTime(data.time) }, remember)
      onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Modal title={record ? '编辑账目记录' : '新增账目'} onClose={onClose}><form onSubmit={submit} className="form">
    <label>商户名称<input required maxLength={120} value={form.merchant} onChange={(e) => { const merchant = e.target.value; setForm((f) => ({ ...f, merchant, category: classify(merchant, f.description, rules) })) }} placeholder="例如：街角咖啡店" /></label>
    <label>消费项目 / 交易说明<input maxLength={300} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value, category: classify(f.merchant, e.target.value, rules) }))} placeholder="例如：午餐、车票、住宿" /></label>
    <div className="form-grid"><label>金额（人民币）<input required type="number" min="0.01" step="0.01" value={form.amountText} onChange={(e) => update('amountText', e.target.value)} /></label><label>记录类型<select value={form.kind} onChange={(e) => update('kind', e.target.value)}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></label></div>
    <label>日期和时间<input required type="datetime-local" step="1" value={form.time.replace(' ', 'T')} onInput={(e) => update('time', e.target.value)} /></label>
    <label>消费分类<select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, categoryManual: true }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label className="checkbox"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />记住此商户的分类，应用于以后新增 / 导入的记录</label>
    {error && <p className="error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? '保存中…' : '保存记录'}</button>
  </form></Modal>
}
export function ImportDialog({ rules, onClose }) {
  const [source, setSource] = useState('auto'), [encoding, setEncoding] = useState('auto'), [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState(new Set()), [done, setDone] = useState(null)
  async function choose(file) {
    if (!file) return
    setBusy(true); setError(''); setResult(null); setDone(null)
    try {
      const parsed = await readBill(file, rules, source, encoding)
      const entries = prepareImport(parsed.records, await db.records.toArray())
      setResult({ ...parsed, entries })
      setSelected(new Set(entries.flatMap((entry, i) => entry.action !== 'duplicate' ? [i] : [])))
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  async function save() {
    setBusy(true); setError('')
    try {
      const counts = { add: 0, update: 0, duplicate: result.entries.filter((e) => e.action === 'duplicate').length, errors: result.errors.length }
      await db.transaction('rw', db.records, async () => {
        const incoming = result.entries.filter((_, i) => selected.has(i)).map((entry) => entry.record)
        const entries = prepareImport(incoming, await db.records.toArray())
        for (const entry of entries) {
          if (entry.action === 'add') await db.records.add(entry.record)
          if (entry.action === 'update') await db.records.put(entry.record)
          counts[entry.action]++
        }
      })
      setDone(counts)
    } catch (err) { setError('导入失败：' + err.message) } finally { setBusy(false) }
  }
  const labels = { add: '新增', update: '更新', duplicate: '重复' }
  return <Modal title="导入账单" onClose={onClose} wide>
    {done ? <><p role="status">新增 {done.add} · 更新 {done.update} · 重复 {done.duplicate} · 异常 {done.errors}</p>{result.errors.length > 0 && <details><summary>异常详情</summary>{result.errors.map((e) => <p key={e.row}>第 {e.row} 行：{e.message}</p>)}</details>}<div className="modal-actions"><button className="button primary" onClick={onClose}>完成</button></div></> : <>
    <div className="form-grid"><label>账单来源<select disabled={busy} value={source} onChange={(e) => { setSource(e.target.value); setResult(null) }}><option value="auto">自动识别</option><option value="alipay">支付宝</option><option value="wechat">微信</option></select></label><label>CSV 编码<select disabled={busy} value={encoding} onChange={(e) => { setEncoding(e.target.value); setResult(null) }}><option value="auto">自动</option><option value="utf-8">UTF-8</option><option value="gb18030">GB18030 / GBK</option></select></label></div>
    <label className="upload-zone"><Upload size={30} /><strong>{busy ? '正在处理…' : '选择支付宝或微信账单'}</strong><span>CSV / XLSX / XLS</span><input aria-label="选择账单文件" type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <><div className="import-summary"><strong>{result.source} · {result.records.length} 条</strong><span>新增 {result.entries.filter((e) => e.action === 'add').length} · 更新 {result.entries.filter((e) => e.action === 'update').length} · 重复 {result.entries.filter((e) => e.action === 'duplicate').length} · 异常 {result.errors.length}</span></div>
      <div className="table-scroll preview-table"><table><thead><tr><th><input aria-label="全选有效记录" type="checkbox" disabled={busy} checked={result.entries.some((e) => e.action !== 'duplicate') && selected.size === result.entries.filter((e) => e.action !== 'duplicate').length} onChange={(e) => setSelected(e.target.checked ? new Set(result.entries.flatMap((entry, i) => entry.action !== 'duplicate' ? [i] : [])) : new Set())} /></th><th>时间</th><th>商户 / 项目</th><th>分类</th><th>金额</th><th>检查</th></tr></thead><tbody>{result.entries.map((entry, i) => { const r = entry.record; return <tr key={i} className={entry.action === 'duplicate' ? 'duplicate' : ''}><td><input type="checkbox" aria-label={'导入第 ' + (i + 1) + ' 条'} disabled={entry.action === 'duplicate' || busy} checked={selected.has(i)} onChange={(e) => setSelected((s) => { const next = new Set(s); if (e.target.checked) next.add(i); else next.delete(i); return next })} /></td><td>{r.time}</td><td>{r.merchant}<small>{r.description}</small></td><td><select aria-label={'第 ' + (i + 1) + ' 条分类'} disabled={entry.action === 'duplicate' || busy} value={r.category} onClick={() => setResult((current) => ({ ...current, entries: current.entries.map((item, index) => index === i ? { ...item, record: { ...item.record, categoryManual: true } } : item) }))} onChange={(e) => { const category = e.target.value; setResult((current) => ({ ...current, entries: current.entries.map((item, index) => index === i ? { ...item, record: { ...item.record, category, categoryManual: true } } : item) })) }}>{categories.map((c) => <option key={c}>{c}</option>)}</select></td><td>{signedMoney(r)}</td><td>{labels[entry.action]}{entry.action === 'update' && <details><summary>查看变更</summary>{entry.changes.filter((f) => ['kind','time','category'].includes(f)).map((f) => <small key={f}>{{ kind: '收支', time: '时间', category: '分类' }[f]}：{entry.previous[f]} → {r[f]}</small>)}<small>补全原始收支信息</small></details>}</td></tr> })}</tbody></table></div>
      {(result.errors.length > 0 || result.skipped > 0) && <details><summary>异常 / 跳过详情</summary>{result.skipped > 0 && <p>跳过 {result.skipped} 条关闭或失败交易</p>}{result.errors.map((e) => <p key={e.row}>第 {e.row} 行：{e.message}</p>)}</details>}
      <div className="modal-actions"><span>已选 {selected.size} 条</span><button className="button primary" disabled={busy || !selected.size} onClick={save}>确认保存 <ArrowRight size={16} /></button></div></>}
    </>}
  </Modal>
}
