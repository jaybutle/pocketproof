import { lazy, Suspense, useMemo, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, FileCheck2, FileText, Filter, LayoutDashboard, LockKeyhole, Menu, MessageSquareText, Search, ShieldCheck, Sparkles, UsersRound, WalletCards, X, type LucideIcon } from 'lucide-react';
import { money } from './format';
const MonthlyChart = lazy(() => import('./MonthlyChart'));

type Page = 'overview' | 'documents' | 'invoices' | 'clients' | 'assistant' | 'reports' | 'privacy';
type Invoice = { id: string; number: string; client: string; issue: string; due: string; total: number; status: 'paid' | 'unpaid' | 'overdue'; note: string };
type NavItem = { id: Page; label: string; icon: LucideIcon };

const nav: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'documents', label: 'Document inbox', icon: FileText },
  { id: 'invoices', label: 'Invoices', icon: WalletCards },
  { id: 'clients', label: 'Clients', icon: UsersRound },
  { id: 'assistant', label: 'Paperwork assistant', icon: Sparkles },
  { id: 'reports', label: 'Reports', icon: Activity },
  { id: 'privacy', label: 'Privacy & settings', icon: ShieldCheck },
];

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const sampleInvoices: Invoice[] = [
  { id: 'sample-1042', number: 'PP-1042', client: 'Juniper Studio', issue: isoDay(-17), due: isoDay(2), total: 185000, status: 'unpaid', note: 'Synthetic sample record' },
  { id: 'sample-1041', number: 'PP-1041', client: 'Northline Labs', issue: isoDay(-36), due: isoDay(-16), total: 420000, status: 'overdue', note: 'Synthetic sample record' },
  { id: 'sample-1040', number: 'PP-1040', client: 'Morrow Design Co.', issue: isoDay(-47), due: isoDay(-32), total: 96000, status: 'paid', note: 'Synthetic sample record' },
  { id: 'sample-1039', number: 'PP-1039', client: 'Juniper Studio', issue: isoDay(-64), due: isoDay(-49), total: 275000, status: 'paid', note: 'Synthetic sample record' },
];
const sampleClients = [
  { name: 'Juniper Studio', email: 'hello@juniper.example', initials: 'JS', tone: 'teal' },
  { name: 'Northline Labs', email: 'ap@northline.example', initials: 'NL', tone: 'blue' },
  { name: 'Morrow Design Co.', email: 'accounts@morrow.example', initials: 'MD', tone: 'amber' },
];
const sampleQuestions = [
  { question: 'Which invoices are overdue?', answer: '1 fictional invoice is overdue: PP-1041 for Northline Labs, $4,200.00.' },
  { question: 'How much is outstanding?', answer: 'The sample workspace has $6,050.00 outstanding across 2 unpaid or overdue invoices.' },
  { question: 'What is due next?', answer: `PP-1042 for Juniper Studio is due ${formatDate(isoDay(2))}: $1,850.00.` },
];
const invoicesTotal = sampleInvoices.reduce((n, i) => n + i.total, 0);
const paidTotal = sampleInvoices.filter(i => i.status === 'paid').reduce((n, i) => n + i.total, 0);
const overdueTotal = sampleInvoices.filter(i => i.status === 'overdue').reduce((n, i) => n + i.total, 0);
const outstandingTotal = sampleInvoices.filter(i => i.status !== 'paid').reduce((n, i) => n + i.total, 0);
const monthly = [...new Set(sampleInvoices.map(i => i.issue.slice(0, 7)))].sort().map(month => ({ month, currency: 'USD', total_minor: sampleInvoices.filter(i => i.issue.startsWith(month)).reduce((n, i) => n + i.total, 0), count: sampleInvoices.filter(i => i.issue.startsWith(month)).length }));

function Brand() { return <a href="/" className="brand"><span className="brand-mark"><FileCheck2 size={19}/></span><span>proofpocket<span className="brand-ai"> AI</span></span></a>; }
function Pill({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className={`status-pill ${tone}`}><i/>{children}</span>; }
function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div>{children&&<div className="page-head-action">{children}</div>}</div>; }

export default function DemoApp() {
  const [page, setPage] = useState<Page>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Invoice|null>(null);
  const [answer, setAnswer] = useState<(typeof sampleQuestions)[number]|null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const pageTitle = nav.find(x => x.id === page)?.label || 'Overview';
  const filteredInvoices = useMemo(() => sampleInvoices.filter(i => (status === 'all' || i.status === status) && `${i.number} ${i.client}`.toLowerCase().includes(query.toLowerCase())), [query, status]);
  const filteredClients = sampleClients.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(clientQuery.toLowerCase()));
  const open = (next: Page) => { setPage(next); setMobileOpen(false); setQuery(''); setStatus('all'); };
  const downloadCsv = () => {
    const quote = (value: string|number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [['Invoice','Client','Issue date','Due date','Amount','Currency','Status'], ...sampleInvoices.map(i => [i.number,i.client,i.issue,i.due,(i.total/100).toFixed(2),'USD',i.status])];
    const blob = new Blob([rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = 'proofpocket-sample-invoices.csv'; a.click(); URL.revokeObjectURL(href);
  };

  return <div className="app-shell demo-app">
    <div className={`mobile-scrim ${mobileOpen?'show':''}`} onClick={() => setMobileOpen(false)}/>
    <aside className={`sidebar ${mobileOpen?'mobile-open':''}`}>
      <div className="side-brand"><Brand/><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">D</div><div className="workspace-label"><strong>Public preview</strong><span>Fictional sample data</span></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Demo sections">{nav.map(({id,label,icon:Icon})=><button key={id} className={`nav-link demo-nav-link ${page===id?'active':''}`} onClick={() => open(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-mini"><div className="privacy-mini-head"><ShieldCheck size={16}/><span>Safe sample preview</span><Check size={15}/></div><p>This hosted demo uses fictional records only. Uploads and edits are disabled.</p><button onClick={() => open('privacy')}>How privacy works <ArrowRight size={13}/></button></div><div className="profile-row"><div className="profile-avatar">PP</div><div><strong>ProofPocket demo</strong><span>Read-only workspace</span></div></div></div>
    </aside>
    <main className="main-shell">
      <div className="demo-readonly-banner"><ShieldCheck size={15}/><span><strong>Read-only demo</strong> · Fictional records only. No uploads, edits, or account data are sent or saved.</span><a href="https://github.com/jaybutle/pocketproof" target="_blank" rel="noreferrer">View source <ArrowRight size={12}/></a></div>
      <header className="topbar"><div className="topbar-title"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={19}/></button><div><h1>{pageTitle}</h1><p>{page === 'overview' ? 'A fictional workspace to explore ProofPocket.' : 'Sample data preview · no personal records.'}</p></div></div><div className="topbar-actions"><Pill tone="ready">Sample workspace</Pill><a className="button secondary demo-source-button" href="https://github.com/jaybutle/pocketproof" target="_blank" rel="noreferrer">Source code <ArrowRight size={14}/></a></div></header>
      <div className="demo-content">
        {page === 'overview' && <Overview open={open} setSelected={setSelected}/>}
        {page === 'documents' && <Documents/>}
        {page === 'invoices' && <Invoices rows={filteredInvoices} query={query} setQuery={setQuery} status={status} setStatus={setStatus} setSelected={setSelected}/>}
        {page === 'clients' && <Clients rows={filteredClients} query={clientQuery} setQuery={setClientQuery}/>}
        {page === 'assistant' && <Assistant answer={answer} setAnswer={setAnswer}/>}
        {page === 'reports' && <Reports downloadCsv={downloadCsv}/>}
        {page === 'privacy' && <Privacy/>}
      </div>
      <footer className="app-footer"><span><LockKeyhole size={12}/> Fictional sample data · no backend connection</span><span>ProofPocket AI <i>·</i> <a href="https://github.com/jaybutle/pocketproof" target="_blank" rel="noreferrer">Open source on GitHub</a></span></footer>
    </main>
    {selected&&<InvoiceDetails invoice={selected} close={() => setSelected(null)}/>}
  </div>;
}

function Overview({ open, setSelected }: { open:(p:Page)=>void; setSelected:(i:Invoice)=>void }) {
  const next = sampleInvoices.find(i => i.status === 'unpaid');
  const recent = sampleInvoices.slice(0, 3);
  return <div className="page-content">
    <section className="welcome-banner"><div className="welcome-copy"><div className="welcome-kicker"><span className="live-dot"/>FICTIONAL SAMPLE WORKSPACE</div><h2>Know what’s due.<br/><em>Stay one step ahead.</em></h2><p>See how reviewed invoice records turn into a clearer view of client balances, payment status, and deadlines.</p><div className="welcome-actions"><button className="button white-button" onClick={() => open('invoices')}>Explore invoices <ArrowRight size={15}/></button><span className="model-chip"><span/>Read-only sample</span></div></div><div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orb-core"><Sparkles size={22}/></div><div className="float-card receipt"><div><FileText size={15}/><span>Review complete</span></div><strong>PP-1042</strong><small>Juniper Studio · fictional</small></div><div className="float-card paid-float"><CheckCircle2 size={15}/><span>Human reviewed</span></div><div className="art-caption">A calmer way to close the books.</div></div></section>
    <div className="sample-data-notice demo-sample-notice"><Sparkles size={14}/><span><strong>All four records are fictional.</strong> This preview makes no API calls and does not accept customer documents.</span><button onClick={() => open('privacy')}>Privacy details <ArrowRight size={13}/></button></div>
    <div className="metric-grid">{[
      {label:'Recorded invoice total',value:money(invoicesTotal,'USD'),change:`${sampleInvoices.length} sample invoices`,icon:FileText,tone:'blue'},
      {label:'Outstanding',value:money(outstandingTotal,'USD'),change:'Across unpaid records',icon:WalletCards,tone:'orange'},
      {label:'Overdue',value:money(overdueTotal,'USD'),change:'1 sample invoice',icon:Clock3,tone:'red'},
      {label:'Paid',value:money(paidTotal,'USD'),change:'2 sample invoices',icon:CheckCircle2,tone:'green'},
    ].map(({label,value,change,icon:Icon,tone})=><section className="panel metric-card" key={label}><div className="metric-top"><div className={`metric-icon ${tone}`}><Icon size={17}/></div><span className="more-button" aria-hidden="true">SAMPLE</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot"><span className={`metric-change ${tone==='red'?'alert':''}`}>{change}</span></div></section>)}</div>
    <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Invoice volume</h3><p>Sample totals by issue month · USD</p></div><span className="period-select">Last 3 months <ChevronDown size={14}/></span></div><Suspense fallback={<div className="chart-wrap"/>}><MonthlyChart data={monthly}/></Suspense></section><section className="panel deadlines-panel"><div className="panel-heading"><div><h3>Upcoming deadlines</h3><p>Keep the next payment dates in view.</p></div><button className="text-link" onClick={() => open('invoices')}>See all <ArrowRight size={13}/></button></div>{next&&<button className="demo-deadline" onClick={() => setSelected(next)}><span className="deadline-date"><span>{next.due.slice(8,10)}</span><small>{new Date(`${next.due}T00:00:00`).toLocaleDateString(undefined,{month:'short'}).toUpperCase()}</small></span><span className="deadline-info"><strong>{next.client}</strong><span>{next.number} · Due {formatDate(next.due)}</span></span><strong className="deadline-amount">{money(next.total,'USD')}</strong></button>}<button className="demo-deadline" onClick={() => setSelected(sampleInvoices[1])}><span className="deadline-date overdue-date"><span>{sampleInvoices[1].due.slice(8,10)}</span><small>{new Date(`${sampleInvoices[1].due}T00:00:00`).toLocaleDateString(undefined,{month:'short'}).toUpperCase()}</small></span><span className="deadline-info"><strong>{sampleInvoices[1].client}</strong><span>{sampleInvoices[1].number} · Past due</span></span><strong className="deadline-amount">{money(sampleInvoices[1].total,'USD')}</strong></button><div className="demo-hint"><CalendarDays size={13}/> Dates are relative to today so the sample stays current.</div></section></div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h3>Sample invoice records</h3><p>Approved records flow into status tracking and reports.</p></div><button className="text-link" onClick={() => open('invoices')}>All invoices <ArrowRight size={13}/></button></div><div className="table-scroll"><table><thead><tr><th>INVOICE</th><th>CLIENT</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{recent.map(i=><tr key={i.id} className="demo-click-row" onClick={() => setSelected(i)}><td><strong>{i.number}</strong><span className="sample-record-tag">SAMPLE</span></td><td>{i.client}</td><td>{formatDate(i.due)}</td><td className="amount-cell">{money(i.total,'USD')}</td><td><Pill tone={i.status}>{i.status}</Pill></td></tr>)}</tbody></table></div></section>
  </div>;
}

function Documents() {
  return <div className="page-content"><PageHeading eyebrow="DOCUMENT INBOX" title="Review before anything is saved." description="The local app extracts text, suggests fields, and waits for your approval. This hosted preview uses a fictional example only."/>
    <div className="demo-doc-layout"><section className="panel demo-doc-card"><div className="demo-doc-top"><span className="demo-doc-icon"><FileText size={20}/></span><div><strong>Example invoice review</strong><span>Fictional document · no file uploaded</span></div><Pill>Sample</Pill></div><div className="demo-invoice-paper"><div className="paper-brand"><i/> JUNIPER STUDIO</div><span>INVOICE · SAMPLE</span><strong>PP-1042</strong><div className="paper-line long"/><div className="paper-line"/><div className="paper-total"><span>Total due</span><b>$1,850.00</b></div></div><div className="demo-doc-foot"><ShieldCheck size={15}/><span>The original app keeps uploads on the user's device. Upload is disabled in this public preview.</span></div></section>
      <section className="panel demo-fields-card"><div className="eyebrow">SAMPLE FIELD SUGGESTIONS</div><h3>Human review comes first</h3><p>These example values illustrate the review step. They were not extracted live in this hosted preview.</p><dl className="demo-fields"><div><dt>Client</dt><dd>Juniper Studio</dd></div><div><dt>Invoice number</dt><dd>PP-1042</dd></div><div><dt>Issue date</dt><dd>{formatDate(sampleInvoices[0].issue)}</dd></div><div><dt>Due date</dt><dd>{formatDate(sampleInvoices[0].due)}</dd></div><div><dt>Currency</dt><dd>USD</dd></div><div><dt>Total</dt><dd>{money(sampleInvoices[0].total,'USD')}</dd></div></dl><div className="demo-review-state"><CheckCircle2 size={16}/><span>In the local app, you check and correct each field before approval.</span></div></section></div>
  </div>;
}

function Invoices({ rows, query, setQuery, status, setStatus, setSelected }: { rows:Invoice[]; query:string; setQuery:(x:string)=>void; status:string; setStatus:(x:string)=>void; setSelected:(x:Invoice)=>void }) {
  return <div className="page-content"><PageHeading eyebrow="INVOICE TRACKER" title="Every invoice, in view." description="Search and filter fictional records. Select a row to see its read-only details."/>
    <section className="panel invoice-summary-strip"><div><span>Sample invoices</span><strong>{sampleInvoices.length}</strong></div><div><span>Outstanding</span><strong>{money(outstandingTotal,'USD')}</strong></div><div><span>Overdue</span><strong className="red-text">1</strong></div><div className="invoice-summary-icon"><WalletCards size={20}/></div></section>
    <div className="table-controls"><label className="table-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sample invoices"/></label><label className="filter-select"><Filter size={15}/><select value={status} onChange={e=>setStatus(e.target.value)}>{['all','unpaid','overdue','paid'].map(s=><option key={s} value={s}>{s==='all'?'All statuses':s}</option>)}</select></label><button className="button secondary" onClick={() => setStatus('all')}>Reset filters</button></div>
    <section className="panel invoice-table-panel"><div className="table-scroll"><table><thead><tr><th>INVOICE</th><th>CLIENT</th><th>ISSUED</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th><th>DETAILS</th></tr></thead><tbody>{rows.map(i=><tr key={i.id}><td><strong>{i.number}</strong><span className="sample-record-tag">SAMPLE</span></td><td>{i.client}</td><td>{formatDate(i.issue)}</td><td className={i.status==='overdue'?'red-text':''}>{formatDate(i.due)}</td><td className="amount-cell">{money(i.total,'USD')}</td><td><Pill tone={i.status}>{i.status}</Pill></td><td><button className="tiny-action" onClick={() => setSelected(i)}>View record <ArrowRight size={12}/></button></td></tr>)}</tbody></table>{!rows.length&&<div className="demo-empty">No sample invoices match those filters.</div>}</div></section>
    <div className="demo-readonly-note"><LockKeyhole size={14}/> Editing and payment actions are disabled in this read-only preview.</div>
  </div>;
}

function Clients({ rows, query, setQuery }: { rows:typeof sampleClients; query:string; setQuery:(x:string)=>void }) {
  const balance = (name:string) => sampleInvoices.filter(i=>i.client===name&&i.status!=='paid').reduce((n,i)=>n+i.total,0);
  return <div className="page-content"><PageHeading eyebrow="CLIENT DIRECTORY" title="Client balances at a glance." description="Fictional client records are linked to invoice examples. Contact details use reserved .example addresses."/>
    <div className="client-toolbar"><label className="table-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sample clients"/></label><Pill tone="ready">3 fictional clients</Pill></div>
    <div className="client-cards">{rows.map(c=>{const related=sampleInvoices.filter(i=>i.client===c.name);return <section className="panel client-card" key={c.name}><div className="client-card-head"><div className={`client-initial ${c.tone}`}>{c.initials}</div><Pill tone="ready">Sample</Pill></div><h3>{c.name}</h3><p>{c.email}</p><div className="client-overview"><div><span className="overview-label">INVOICES</span><strong className="overview-number">{related.length}</strong><span className="overview-sub">sample records</span></div><div><span className="overview-label">OPEN BALANCE</span><strong className="overview-number">{money(balance(c.name),'USD')}</strong><span className="overview-sub">fictional amount</span></div></div><div className="client-invoice-list">{related.map(i=><div key={i.id}><span>{i.number}</span><span>{money(i.total,'USD')}</span></div>)}</div></section>})}</div>
  </div>;
}

function Assistant({ answer, setAnswer }: { answer:(typeof sampleQuestions)[number]|null; setAnswer:(q:(typeof sampleQuestions)[number])=>void }) {
  return <div className="page-content"><PageHeading eyebrow="PAPERWORK ASSISTANT" title="Ask about the sample records." description="Explore example answers grounded in the fictional invoices. The hosted preview does not call an AI model."/>
    <div className="assistant-layout demo-assistant-layout"><section className="panel demo-chat-panel"><div className="demo-chat-head"><div className="side-card-icon teal"><Sparkles size={18}/></div><div><strong>Sample insights</strong><span>Prewritten examples · no model request</span></div><Pill>Preview</Pill></div><div className="demo-chat-messages"><div className="demo-assistant-message"><span className="demo-bot-avatar"><Sparkles size={15}/></span><div><strong>ProofPocket demo</strong><p>Try a sample question. Answers are calculated from the fictional invoices shown in this preview.</p></div></div>{answer&&<><div className="demo-user-message">{answer.question}</div><div className="demo-assistant-message"><span className="demo-bot-avatar"><Sparkles size={15}/></span><div><strong>Sample answer</strong><p>{answer.answer}</p><small>Source: fictional invoice records</small></div></div></>}</div><div className="demo-question-list">{sampleQuestions.map(q=><button key={q.question} className="demo-question" onClick={() => setAnswer(q)}><MessageSquareText size={14}/>{q.question}<ArrowRight size={13}/></button>)}</div></section><aside className="assistant-side"><section className="panel assistant-side-card"><div className="side-card-icon teal"><ShieldCheck size={17}/></div><h3>Grounded, not guessed</h3><p>The local app calculates money from approved records. This public preview uses fixed sample answers.</p></section><section className="panel assistant-side-card caution"><div className="side-card-icon amber"><LockKeyhole size={17}/></div><h3>No private prompts</h3><p>The demo has no chat backend. Questions stay in this page and are not transmitted.</p></section></aside></div>
  </div>;
}

function Reports({ downloadCsv }: { downloadCsv:()=>void }) {
  const clients = sampleClients.map(c=>({ ...c, open:sampleInvoices.filter(i=>i.client===c.name&&i.status!=='paid').reduce((n,i)=>n+i.total,0), count:sampleInvoices.filter(i=>i.client===c.name).length }));
  const overdue = sampleInvoices.filter(i=>i.status==='overdue');
  return <div className="page-content"><PageHeading eyebrow="REPORTS" title="A clearer view of the sample books." description="Totals are calculated from fictional records and grouped in USD."><button className="button secondary" onClick={downloadCsv}><ArrowDownToLine size={15}/> Download sample CSV</button></PageHeading>
    <div className="report-cards"><section className="panel"><span>Recorded invoice total</span><strong>{money(invoicesTotal,'USD')}</strong><small>Across 4 sample invoices</small></section><section className="panel"><span>Marked paid</span><strong>{money(paidTotal,'USD')}</strong><small>2 fictional records</small></section><section className="panel"><span>Outstanding</span><strong>{money(outstandingTotal,'USD')}</strong><small>Unpaid and overdue samples</small></section></div>
    <div className="report-grid"><section className="panel demo-report-panel"><div className="panel-heading"><div><h3>Monthly invoice totals</h3><p>Grouped by issue month · USD</p></div></div><Suspense fallback={<div className="chart-wrap"/>}><MonthlyChart data={monthly}/></Suspense></section><section className="panel demo-report-panel"><div className="panel-heading"><div><h3>Client balances</h3><p>Open amounts from sample invoices.</p></div></div><div className="table-scroll"><table><thead><tr><th>CLIENT</th><th>INVOICES</th><th>OPEN BALANCE</th></tr></thead><tbody>{clients.map(c=><tr key={c.name}><td>{c.name}</td><td>{c.count}</td><td className="amount-cell">{money(c.open,'USD')}</td></tr>)}</tbody></table></div></section></div>
    <section className="panel report-overdue demo-overdue-panel"><div className="panel-heading"><div><h3>Overdue sample invoices</h3><p>Due dates compared with today's date.</p></div><span className="overdue-count">{overdue.length} overdue</span></div><div className="table-scroll"><table><thead><tr><th>INVOICE</th><th>CLIENT</th><th>DUE</th><th>AMOUNT</th></tr></thead><tbody>{overdue.map(i=><tr key={i.id}><td>{i.number}</td><td>{i.client}</td><td className="red-text">{formatDate(i.due)}</td><td className="amount-cell">{money(i.total,'USD')}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function Privacy() {
  return <div className="page-content"><PageHeading eyebrow="PRIVACY & SETTINGS" title="A safe preview with made-up records." description="This Vercel build is a static, read-only sample. It has no database, upload endpoint, or AI service."/>
    <div className="settings-layout"><div className="settings-main"><section className="panel settings-panel"><div className="settings-panel-head"><div className="setting-icon teal"><ShieldCheck size={18}/></div><div><h3>What this hosted demo does</h3><p>Runs entirely in your browser from a static bundle.</p></div></div><ul className="demo-privacy-list"><li><Check size={15}/>Displays fictional invoices, clients, and reports only.</li><li><Check size={15}/>Does not send prompts, files, or financial data to an API.</li><li><Check size={15}/>Does not save edits or accept document uploads.</li><li><Check size={15}/>Uses no login, analytics, or hosted AI service.</li></ul></section><section className="panel settings-panel"><div className="settings-panel-head"><div className="setting-icon blue"><FileCheck2 size={18}/></div><div><h3>Run the full local app</h3><p>Local mode includes document uploads, SQLite, OCR, and Ollama.</p></div></div><a className="button secondary demo-install-link" href="https://github.com/jaybutle/pocketproof#macos-setup" target="_blank" rel="noreferrer">Open installation guide <ArrowRight size={14}/></a></section></div>
      <aside className="settings-aside"><section className="panel privacy-card"><div className="privacy-shield"><LockKeyhole size={23}/></div><h3>The local version is different.</h3><ul><li><Check size={15}/>SQLite and uploaded files stay on the user's computer.</li><li><Check size={15}/>Ollama runs on the user's machine.</li><li><Check size={15}/>AI suggestions are reviewed before saving.</li><li><Check size={15}/>Totals and overdue state are calculated by app code.</li></ul><p>The local database is not encrypted by ProofPocket. Do not upload real financial documents to this hosted sample preview.</p></section></aside></div>
  </div>;
}

function InvoiceDetails({ invoice, close }: { invoice:Invoice; close:()=>void }) {
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="simple-modal demo-details-modal" role="dialog" aria-modal="true" aria-labelledby="demo-invoice-title"><div className="modal-head"><div><div className="eyebrow">FICTIONAL RECORD · READ ONLY</div><h2 id="demo-invoice-title">{invoice.number}</h2><p>{invoice.client}</p></div><button className="icon-button" aria-label="Close details" onClick={close}><X size={18}/></button></div><dl className="demo-fields"><div><dt>Issue date</dt><dd>{formatDate(invoice.issue)}</dd></div><div><dt>Due date</dt><dd>{formatDate(invoice.due)}</dd></div><div><dt>Amount</dt><dd>{money(invoice.total,'USD')}</dd></div><div><dt>Status</dt><dd><Pill tone={invoice.status}>{invoice.status}</Pill></dd></div><div><dt>Source</dt><dd>{invoice.note}</dd></div></dl><div className="modal-foot"><span>All values in this preview are synthetic.</span><button className="button secondary" onClick={close}>Close</button></div></section></div>;
}
