import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MapPin, Plus, Upload, Wallet, ArrowUpRight, ArrowDownLeft, Search, SlidersHorizontal, ShieldCheck, Pencil, Trash2, Mountain, List, ChartNoAxesCombined, Tags, Download } from 'lucide-react'
import { db } from './db.js'
import { categories, colors, kinds, money, summarize, signedMoney, recordKind } from './domain.js'
import Charts from './Charts.jsx'
import { ImportDialog, RecordDialog, Modal } from './Dialogs.jsx'

export default function App() {
  const [dbError, setDbError] = useState('')
  const data = useLiveQuery(async () => {
    try { return await db.transaction('r', db.records, db.rules, async () => ({ records: await db.records.toArray(), rules: await db.rules.toArray() })) }
    catch (e) { setDbError(`本地数据库读取失败：${e.message}`); return { records: [], rules: [] } }
  }, [])
  const [month, setMonth] = useState(null), [tab, setTab] = useState('overview'), [dialog, setDialog] = useState(null), [error, setError] = useState('')
  const [deletion, setDeletion] = useState(null)
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [kind, setKind] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [group, setGroup] = useState('date')
  const rules = data?.rules || [], allRecords = data?.records || []
  const months = [...new Set(allRecords.map((r) => r.time.slice(0, 7)))].sort().reverse()
  const currentMonth = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit' }).format(new Date())
  const selectedMonth = month ?? months[0] ?? currentMonth
  const records = useMemo(() => selectedMonth === 'all' ? allRecords : allRecords.filter((r) => r.time.slice(0, 7) === selectedMonth), [data, selectedMonth])
  const filtered = records.filter((r) => (!category || r.category === category) && (!kind || recordKind(r) === kind) && (!from || r.time.slice(0, 10) >= from) && (!to || r.time.slice(0, 10) <= to) && `${r.merchant} ${r.description}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.time.localeCompare(a.time))
  const stats = useMemo(() => summarize(records), [records])
  
  async function action(fn) { try { setError(''); await fn() } catch (e) { setError(`操作失败：${e.message}`) } }
  async function saveRecord(record, remember) {
    await db.transaction('rw', db.records, db.rules, async () => {
      const next = { ...record, fingerprint: record.id ? record.fingerprint : `manual:${crypto.randomUUID()}` }
      if (record.id) await db.records.put(next); else await db.records.add(next)
      if (remember) {
        const matches = await db.rules.where('keyword').equals(record.merchant).toArray()
        await db.rules.bulkDelete(matches.filter((r) => r.exact).map((r) => r.id))
        await db.rules.add({ keyword: record.merchant, category: record.category, exact: true, updatedAt: Date.now() })
      }
    })
  }
  function changeMonth(id) { setMonth(id); setSearch(''); setCategory(''); setKind(''); setFrom(''); setTo('') }
  function backup() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = `生活账本-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (!data) return <div className="loading">正在打开本地生活账本…</div>
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-icon"><Mountain size={27} /></span><div>生活记账<span>LIFE LEDGER</span></div></div>
      {[['overview', ChartNoAxesCombined, '生活总览'], ['records', List, '账目明细'], ['rules', Tags, '分类规则']].map(([id, Icon, label]) => <button key={id} className={`nav-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}><Icon size={18} />{label}{tab === id && <span className="active-dot" />}</button>)}
      <div className="nav-caption trip-caption">月份</div>
      <div className="trip-list">{['all', ...(months.length ? months : [currentMonth])].map((m) => <button key={m} className={`trip-button ${selectedMonth === m ? 'selected' : ''}`} onClick={() => changeMonth(m)}><MapPin size={16} /><span>{m === 'all' ? '全部月份' : m}</span><small>{m === 'all' ? allRecords.length : allRecords.filter((r) => r.time.slice(0, 7) === m).length}</small></button>)}</div>
      <button className="backup-button" onClick={backup}><Download size={18} />导出备份</button>
    </aside>
    <main><header className="topbar"><span><span className="muted">生活账本</span><span className="crumb">/</span>{selectedMonth === 'all' ? '全部月份' : selectedMonth}</span><span className="local-indicator"><ShieldCheck size={14} /> 本地账本</span></header><div className="page-content">
      <header className="page-heading"><div><h1>{tab === 'rules' ? '分类规则' : tab === 'records' ? '账目明细' : '生活总览'}</h1></div><div className="heading-actions">{tab !== 'rules' && <><button className="button" onClick={() => setDialog({ type: 'import' })}><Upload size={16} />导入账单</button><button className="button primary" onClick={() => setDialog({ type: 'record' })}><Plus size={17} />记一笔</button></>}</div></header>
      {(error || dbError) && <p className="error" role="alert">{error || dbError}</p>}
      {tab === 'rules' ? <Rules rules={rules} action={action} /> : <>
        {tab === 'overview' && <><section className="stats-grid"><div className="stat-card main-stat"><div className="stat-label"><Wallet size={17} />总消费</div><strong>{money(stats.net)}</strong></div><div className="stat-card"><div className="stat-label"><ArrowUpRight size={17} />累计支出</div><strong>{money(stats.expense)}</strong></div><div className="stat-card"><div className="stat-label"><ArrowDownLeft size={17} />累计收入</div><strong>{money(stats.income)}</strong></div><div className="stat-card"><div className="stat-label"><MapPin size={17} />消费日均</div><strong>{money(Object.keys(stats.byDay).length ? Math.round(stats.net / Object.keys(stats.byDay).length) : 0)}</strong></div></section><Charts stats={stats} /><section className="panel merchant-panel"><div className="panel-title"><h2>消费汇总</h2></div><div className="summary-grid"><Summary title="按分类" values={stats.byCategory} /><Summary title="按日期" values={stats.byDay} /></div></section></>}
        <section className="panel records-panel"><div className="panel-title"><h2>{tab === 'overview' ? '账目记录' : '全部账目明细'}<span className="count">{filtered.length}</span></h2></div><div className="filters"><div className="search"><Search size={16} /><input aria-label="搜索商户或消费项目" placeholder="搜索商户、消费项目…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select aria-label="按分类筛选" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">全部分类</option>{categories.map((c) => <option key={c}>{c}</option>)}</select><select aria-label="按类型筛选" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">全部类型</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select><input type="date" aria-label="开始日期" value={from} onInput={(e) => setFrom(e.target.value)} /><span className="muted">至</span><input type="date" aria-label="结束日期" min={from} value={to} onInput={(e) => setTo(e.target.value)} /><button className="text-button" onClick={() => { setSearch(''); setCategory(''); setKind(''); setFrom(''); setTo('') }}>重置</button></div>
          <div className="group-tabs"><SlidersHorizontal size={14} /><span>查看方式</span>{[['date', '日期'], ['category', '分类'], ['merchant', '商户']].map(([id, text]) => <button key={id} className={group === id ? 'selected' : ''} onClick={() => setGroup(id)}>{text}</button>)}</div>
          {filtered.length ? <RecordTable records={filtered} group={group} onEdit={(record) => setDialog({ type: 'record', record })} onDelete={(record) => { setDeletion({ message: `删除「${record.merchant}」的 ${money(record.amount)} 记录？`, run: () => db.records.delete(record.id) }) }} /> : <div className="empty"><Wallet size={33} strokeWidth={1} /><h3>{records.length ? '没有匹配的记录' : '暂无账目记录'}</h3><p>{records.length ? '请调整筛选条件。' : '导入账单或新增账目记录。'}</p>{!records.length && <button className="text-button" onClick={() => setDialog({ type: 'record' })}><Plus size={15} />新增记录</button>}</div>}
        </section></>}
    </div></main>
    {deletion && <Modal title="确认删除" onClose={() => setDeletion(null)}><p className="muted">{deletion.message}</p><div className="modal-actions"><button className="button" onClick={() => setDeletion(null)}>取消</button><button className="button primary" onClick={() => { const run = deletion.run; setDeletion(null); action(run) }}>确认删除</button></div></Modal>}
    {dialog?.type === 'record' && <RecordDialog record={dialog.record} rules={rules} onClose={() => setDialog(null)} onSave={saveRecord} />}
    {dialog?.type === 'import' && <ImportDialog rules={rules} onClose={() => setDialog(null)} />}

  </div>
}
function Summary({ title, values }) {
  return <div className="summary-list"><h3>{title}</h3>{Object.entries(values).sort((a, b) => b[1] - a[1]).map(([key, value]) => <div key={key}><span title={key}>{key}</span><strong>{money(value)}</strong></div>)}{!Object.keys(values).length && <p className="muted">暂无账目记录</p>}</div>
}
function RecordTable({ records, group, onEdit, onDelete }) {
  const grouped = Object.groupBy(records, (r) => group === 'date' ? r.time.slice(0, 10) : r[group])
  return <div className="table-scroll"><table><thead><tr><th>商户 / 消费项目</th><th>分类</th><th>日期与时间</th><th className="align-right">金额</th><th className="align-right">操作</th></tr></thead><tbody>{Object.entries(grouped).map(([key, rows]) => <RecordGroup key={key} name={key} rows={rows} onEdit={onEdit} onDelete={onDelete} />)}</tbody></table></div>
}
function RecordGroup({ name, rows, onEdit, onDelete }) {
  return <><tr className="group-row"><td colSpan="5">{name}<span>{rows.length} 笔 · 净消费 {money(summarize(rows).net)}</span></td></tr>{rows.map((r) => <tr key={r.id}><td><div className="merchant-cell"><span className="merchant-icon" style={{ color: colors[categories.indexOf(r.category)] }}>{r.merchant.slice(0, 1)}</span><div><strong>{r.merchant}</strong><small>{r.description || '手动记录'}</small></div></div></td><td><span className="category-chip"><i style={{ background: colors[categories.indexOf(r.category)] }} />{r.category}</span></td><td>{r.time.slice(0, 10)}<small>{r.time.slice(11)}</small></td><td className={`amount align-right ${recordKind(r) === '收入' ? 'income' : ''}`}>{signedMoney(r)}</td><td><div className="row-actions"><button className="icon" aria-label={`编辑 ${r.merchant}`} onClick={() => onEdit(r)}><Pencil size={15} /></button><button className="icon danger" aria-label={`删除 ${r.merchant}`} onClick={() => onDelete(r)}><Trash2 size={15} /></button></div></td></tr>)}</>
}
function Rules({ rules, action }) {
  const [keyword, setKeyword] = useState(''), [category, setCategory] = useState('餐饮'), [exact, setExact] = useState(false), [editingId, setEditingId] = useState(null)
  return <section className="panel rules-panel"><div className="panel-title"><h2>我的分类规则</h2><span>{rules.length} 条</span></div><p className="muted">商户精确匹配优先于关键词，同级规则优先使用最近保存的一条。内置关键词作为兜底；规则应用于以后新增或导入的记录。</p><form className="rule-form" onSubmit={(e) => { e.preventDefault(); if (!keyword.trim()) return; action(async () => { const rule = { keyword: keyword.trim(), category, exact, updatedAt: Date.now() }; if (editingId) await db.rules.put({ ...rule, id: editingId }); else await db.rules.add(rule); setKeyword(''); setEditingId(null) }) }}><label>商户 / 关键词<input required maxLength={120} placeholder="例如：瑞幸" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></label><label>归入分类<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} />商户名称精确匹配</label><button className="button primary">{editingId ? '保存修改' : '添加规则'}</button>{editingId && <button type="button" className="button" onClick={() => { setEditingId(null); setKeyword('') }}>取消</button>}</form><div className="rules-list">{rules.map((r) => <div key={r.id}><span className="rule-icon"><Tags size={17} /></span><strong>{r.keyword}</strong><span className="muted">{r.exact ? '商户精确匹配' : '商户 / 说明包含关键词'}</span><span className="category-chip">{r.category}</span><button className="icon" aria-label={`编辑规则 ${r.keyword}`} onClick={() => { setEditingId(r.id); setKeyword(r.keyword); setCategory(r.category); setExact(r.exact) }}><Pencil size={16} /></button><button className="icon danger" aria-label={`删除规则 ${r.keyword}`} onClick={() => action(() => db.rules.delete(r.id))}><Trash2 size={16} /></button></div>)}{!rules.length && <div className="empty"><Tags size={30} /><h3>暂无自定义规则</h3><p>编辑账目记录时，也可以勾选“记住此商户的分类”。</p></div>}</div></section>
}





