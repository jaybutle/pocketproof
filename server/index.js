import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { createWorker } from 'tesseract.js';
import { z } from 'zod';
import { createStore, invoiceStatus, calculateStats } from './store.js';
import { getOllamaStatus, extractDocumentFields, explainMissingFields, answerDocumentQuestion, generatePaymentReminder } from './ai.js';
import { clientSchema, invoiceSchema, documentReviewSchema } from './schemas.js';
import { supportedMimeTypes, hasSupportedSignature } from './upload-validation.js';

const PORT = Number(process.env.PORT || 4174);
const MAX_BYTES = Math.min(Number(process.env.MAX_UPLOAD_MB || 12), 20) * 1024 * 1024;
const { db, dir } = createStore();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '150kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers.origin) {
    let origin;try{origin=new URL(req.headers.origin);}catch{return res.status(403).json({error:'Cross-origin changes are not allowed.'});}
    const allowed = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://127.0.0.1:5173', 'http://localhost:5173']);
    if (!allowed.has(origin.origin)) return res.status(403).json({ error: 'Cross-origin changes are not allowed.' });
  }
  next();
});

const upload = multer({
  storage: multer.diskStorage({ destination: path.join(dir, 'uploads'), filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`) }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, supportedMimeTypes.includes(file.mimetype))
});
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const getInvoices = () => db.prepare(`SELECT i.*, d.filename AS source_filename FROM invoices i LEFT JOIN documents d ON d.id=i.document_id ORDER BY i.created_at DESC`).all().map(i => ({ ...i, status: invoiceStatus(i) }));
const safeError = (res, error, code = 400) => {
  if (error instanceof z.ZodError) return res.status(code).json({ error: 'Please check the submitted fields.' });
  const message=String(error?.message || '');
  const known=['Ollama is unavailable. Start Ollama and confirm the configured model is installed.','Local model request timed out. Check Ollama and try again.','The local model returned malformed JSON. Retry extraction or enter the fields manually.','The local model response did not match the required fields. Retry extraction or enter the fields manually.','No readable text was extracted from this file.','For privacy, Ollama must run on this device. OLLAMA_URL must use localhost or 127.0.0.1.','OLLAMA_URL must point to a local Ollama instance.','Configured model'];
  const publicMessage=known.some(x=>message.startsWith(x))?message:(code===503?'Local AI could not complete the request. Check Ollama and try again.':'Request could not be completed.');
  return res.status(code).json({ error: publicMessage });
};

app.get('/api/health', (_req,res) => res.json({ ok: true, database: 'sqlite', storage: 'local' }));
app.get('/api/ai/status', async (_req,res) => res.json(await getOllamaStatus()));

app.get('/api/dashboard', (_req,res) => {
  const invoices = getInvoices();
  const stats = calculateStats(invoices);
  const docs = db.prepare('SELECT id,filename,kind,status,created_at FROM documents ORDER BY created_at DESC LIMIT 6').all();
  const upcoming = invoices.filter(i => i.status === 'unpaid' && i.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,5);
  const monthly = db.prepare(`SELECT substr(issue_date,1,7) month, currency, SUM(total_minor) total_minor, COUNT(*) count FROM invoices WHERE issue_date >= date('now','-5 months','start of month') GROUP BY month,currency ORDER BY month`).all();
  res.json({ ...stats, sampleData: invoices.some(i=>i.notes==='Clearly labeled interactive sample record.'), documentsProcessed: db.prepare('SELECT COUNT(*) count FROM documents').get().count, recent: docs, upcoming, monthly });
});
app.post('/api/demo/sample', (_req,res) => {
  if (db.prepare('SELECT COUNT(*) count FROM invoices').get().count) return res.status(409).json({error:'Sample records are only added to an empty workspace.'});
  const stamp=now();
  const demoClients=[['Juniper Studio','hello@juniper.example'],['Northline Labs','ap@northline.example'],['Morrow Design Co.','accounts@morrow.example']];
  const clientIds=demoClients.map(([name,email])=>{const cid=id();db.prepare('INSERT INTO clients(id,name,email,notes,created_at) VALUES(?,?,?,?,?)').run(cid,name,email,'Sample data for the interactive demo.',stamp);return cid;});
  const examples=[['PP-1042',0,'Juniper Studio','2026-10-01','2026-10-20',185000,'unpaid'],['PP-1041',1,'Northline Labs','2026-09-12','2026-10-02',420000,'unpaid'],['PP-1040',2,'Morrow Design Co.','2026-09-01','2026-09-15',96000,'paid'],['PP-1039',0,'Juniper Studio','2026-08-15','2026-08-30',275000,'paid']];
  for(const [number,n,name,issue,due,total,status] of examples)db.prepare('INSERT INTO invoices(id,client_id,number,client_name,issue_date,due_date,currency,total_minor,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id(),clientIds[n],number,name,issue,due,'USD',total,status,'Clearly labeled interactive sample record.',stamp,stamp);
  res.status(201).json({message:'Sample records added. They are labeled as demo data.',count:examples.length});
});

app.get('/api/invoices', (req,res) => {
  const q = String(req.query.q || '').slice(0,120).toLowerCase();
  const status = String(req.query.status || 'all');
  let rows = getInvoices().filter(i => !q || `${i.number || ''} ${i.client_name}`.toLowerCase().includes(q));
  if (['draft','unpaid','paid','overdue','disputed'].includes(status)) rows = rows.filter(i => i.status === status);
  res.json(rows);
});
app.post('/api/invoices', (req,res) => {
  try {
    const input = invoiceSchema.parse(req.body); const stamp = now(); const invoiceId = id();
    const matchingClient=input.client_id?{id:input.client_id}:db.prepare('SELECT id FROM clients WHERE lower(trim(name))=lower(trim(?))').get(input.client_name);
    db.prepare(`INSERT INTO invoices(id,client_id,number,client_name,issue_date,due_date,currency,total_minor,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(invoiceId,matchingClient?.id || null,input.number || null,input.client_name,input.issue_date || null,input.due_date || null,input.currency.toUpperCase(),input.total_minor,input.status,input.notes || '',stamp,stamp);
    res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId));
  } catch(e) { safeError(res,e); }
});
app.patch('/api/invoices/:id', (req,res) => {
  try {
    const current = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id); if (!current) return res.status(404).json({error:'Invoice not found.'});
    const input = invoiceSchema.partial().parse(req.body); const merged = { ...current, ...input };
    db.prepare(`UPDATE invoices SET client_id=?,number=?,client_name=?,issue_date=?,due_date=?,currency=?,total_minor=?,status=?,notes=?,updated_at=? WHERE id=?`).run(merged.client_id || null,merged.number || null,merged.client_name,merged.issue_date || null,merged.due_date || null,merged.currency.toUpperCase(),merged.total_minor,merged.status,merged.notes || '',now(),current.id);
    res.json(getInvoices().find(x => x.id === current.id));
  } catch(e) { safeError(res,e); }
});
app.delete('/api/invoices/:id', (req,res) => { const result = db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id); result.changes ? res.status(204).end() : res.status(404).json({error:'Invoice not found.'}); });

app.get('/api/clients', (_req,res) => {
  const invoices=getInvoices();
  const clients=db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.json(clients.map(c=>{
    const linked=invoices.filter(i=>i.client_id===c.id);
    const grouped=new Map();
    for(const i of linked)if(['unpaid','overdue','disputed'].includes(i.status)){const currency=i.currency||'USD';grouped.set(currency,(grouped.get(currency)||0)+i.total_minor);}
    return {...c,invoice_count:linked.length,balance_by_currency:[...grouped].map(([currency,balance_minor])=>({currency,balance_minor}))};
  }));
});
app.post('/api/clients', (req,res) => { try { const x=clientSchema.parse(req.body); const clientId=id(); db.prepare('INSERT INTO clients(id,name,email,notes,created_at) VALUES(?,?,?,?,?)').run(clientId,x.name,x.email || '',x.notes || '',now()); db.prepare('UPDATE invoices SET client_id=?,updated_at=? WHERE client_id IS NULL AND lower(trim(client_name))=lower(trim(?))').run(clientId,now(),x.name); res.status(201).json(db.prepare('SELECT * FROM clients WHERE id=?').get(clientId)); } catch(e) { safeError(res,e); } });
app.patch('/api/clients/:id', (req,res) => { try { const x=clientSchema.partial().parse(req.body); const old=db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id); if(!old)return res.status(404).json({error:'Client not found.'}); const m={...old,...x}; db.prepare('UPDATE clients SET name=?,email=?,notes=? WHERE id=?').run(m.name,m.email || '',m.notes || '',old.id); res.json(db.prepare('SELECT * FROM clients WHERE id=?').get(old.id)); } catch(e){safeError(res,e);} });
app.delete('/api/clients/:id', (req,res) => { const result=db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id); result.changes?res.status(204).end():res.status(404).json({error:'Client not found.'}); });

app.get('/api/documents', (_req,res) => res.json(db.prepare('SELECT id,filename,mime_type,kind,status,created_at FROM documents ORDER BY created_at DESC').all()));
app.post('/api/documents/upload', (req,res) => upload.single('file')(req,res,async error => {
  if(error) return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'This file is too large. Maximum upload size is configured in settings.':'Choose a PDF, PNG, JPEG, or WebP file.'});
  if(!req.file) return res.status(400).json({error:'Choose a supported document first.'});
  try {
    const bytes=fs.readFileSync(req.file.path); const type=req.file.mimetype;
    const valid=hasSupportedSignature(type,bytes);
    if(!valid) { fs.unlinkSync(req.file.path); return res.status(400).json({error:'The file contents do not match a supported document type.'}); }
    let text='';
    if(type==='application/pdf') { const parsed=await pdfParse(bytes); text=parsed.text?.trim() || ''; }
    else { const worker=await createWorker('eng'); try { const result=await worker.recognize(req.file.path); text=result.data.text?.trim() || ''; } finally { await worker.terminate(); } }
    if(!text) { fs.unlinkSync(req.file.path); return res.status(422).json({error:'No readable text was found. Scanned PDFs are not supported yet; upload an image or enter the invoice manually.'}); }
    if(text.length>30000) text=text.slice(0,30000);
    const docId=id(); const time=now();
    db.prepare('INSERT INTO documents(id,filename,mime_type,extracted_text,status,source_path,created_at) VALUES(?,?,?,?,?,?,?)').run(docId,path.basename(req.file.originalname).slice(0,150),type,text,'review',req.file.path,time);
    let extraction=null; let aiError=null;
    try { extraction=await extractDocumentFields(text); extraction.warnings=[...new Set([...extraction.warnings,...explainMissingFields(extraction)])]; db.prepare('UPDATE documents SET kind=?,extraction_json=? WHERE id=?').run(extraction.kind,JSON.stringify(extraction),docId); }
    catch(e){aiError=e.message;}
    res.status(201).json({id:docId,filename:path.basename(req.file.originalname).slice(0,150),text,extraction,aiGenerated:Boolean(extraction),aiError,created_at:time});
  } catch(e) { if(req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); console.error('Document processing failed.'); res.status(422).json({error:'This document could not be processed. Check that it is readable and try a different supported file.'}); }
}));
app.post('/api/documents/:id/approve', (req,res) => {
  try {
    const doc=db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id); if(!doc)return res.status(404).json({error:'Document not found.'});
    if(req.body?.kind!=='invoice')return res.status(422).json({error:'Only a reviewed invoice document can be added to the invoice tracker.'});
    const x=invoiceSchema.parse(req.body); const stamp=now(); const invoiceId=id();
    db.prepare('UPDATE documents SET kind=? WHERE id=?').run('invoice',doc.id);
    const matchingClient=x.client_id?{id:x.client_id}:db.prepare('SELECT id FROM clients WHERE lower(trim(name))=lower(trim(?))').get(x.client_name);
    db.prepare(`INSERT INTO invoices(id,document_id,client_id,number,client_name,issue_date,due_date,currency,total_minor,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(invoiceId,doc.id,matchingClient?.id || null,x.number || null,x.client_name,x.issue_date || null,x.due_date || null,x.currency.toUpperCase(),x.total_minor,x.status,x.notes || '',stamp,stamp);
    db.prepare('UPDATE documents SET status=? WHERE id=?').run('approved',doc.id);
    res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId));
  }catch(e){safeError(res,e);}
});
app.post('/api/documents/:id/review', (req,res) => {
  try {
    const doc=db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);if(!doc)return res.status(404).json({error:'Document not found.'});
    const review=documentReviewSchema.parse(req.body);
    const extraction=JSON.parse(doc.extraction_json||'{}');
    const reviewed={...extraction,kind:review.kind,...review.fields,warnings:extraction.warnings||[]};
    db.prepare('UPDATE documents SET kind=?,status=?,extraction_json=? WHERE id=?').run(review.kind,'approved',JSON.stringify(reviewed),doc.id);
    res.json({id:doc.id,kind:review.kind,status:'approved'});
  }catch(e){safeError(res,e);}
});
app.delete('/api/documents/:id', (req,res) => { const doc=db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id); if(!doc)return res.status(404).json({error:'Document not found.'}); if(doc.source_path && fs.existsSync(doc.source_path))fs.unlinkSync(doc.source_path); db.prepare('DELETE FROM documents WHERE id=?').run(doc.id); res.status(204).end(); });

app.post('/api/assistant/ask', async (req,res) => {
  const question=String(req.body?.question || '').trim().slice(0,1000); if(!question)return res.status(400).json({error:'Enter a question.'});
  const records=getInvoices(); const lower=question.toLowerCase();
  if(/how much|total|outstanding|overdue amount|paid amount/.test(lower)) {
    if(!records.length)return res.json({answer:'There are no saved invoices yet, so I cannot calculate a paperwork total.',source:'calculated'});
    const stats=calculateStats(records); const key=lower.includes('paid')?'paidMinor':lower.includes('overdue')?'overdueMinor':lower.includes('outstanding')?'outstandingMinor':'totalMinor';
    const label={paidMinor:'paid',overdueMinor:'overdue',totalMinor:'recorded invoice total',outstandingMinor:'outstanding'}[key];
    const values=stats.byCurrency.map(x=>new Intl.NumberFormat('en-US',{style:'currency',currency:x.currency}).format(x[key]/100)).join(', ') || '0.00';
    return res.json({answer:`Your ${label} amount is ${values} across ${records.length} saved invoices. Amounts are grouped by their recorded currencies; no exchange-rate conversion is applied.`,source:'calculated'});
  }
  const currentMonth=new Date().toISOString().slice(0,7);
  const overdueQuery=lower.includes('overdue');
  const dueMonthQuery=lower.includes('due this month');
  const missingDueQuery=lower.includes('missing due');
  const documentQuery=/paperwork|documents? (i )?(processed|uploaded)|summari[sz]e.*processed/.test(lower);
  let relevant=overdueQuery?records.filter(i=>i.status==='overdue'):dueMonthQuery?records.filter(i=>i.due_date?.startsWith(currentMonth)):missingDueQuery?records.filter(i=>!i.due_date):records;
  if(!overdueQuery&&!dueMonthQuery&&!missingDueQuery) {
    const terms=lower.split(/\W+/).filter(t=>t.length>3&&!['invoice','invoices','client','which','about','this','that','what','show','tell','summarize','summary','paperwork'].includes(t));
    const matched=terms.length?relevant.filter(i=>terms.some(t=>`${i.number||''} ${i.client_name}`.toLowerCase().includes(t))):[];
    if(matched.length)relevant=matched;
  }
  relevant=relevant.slice(0,40);
  if((overdueQuery||dueMonthQuery||missingDueQuery)&&!relevant.length)return res.json({answer:overdueQuery?'There are no overdue invoices in your saved records.':dueMonthQuery?'No saved invoices are due this month.':'No saved invoices are missing a due date.',source:'calculated'});
  const documents=documentQuery?db.prepare('SELECT filename,kind,status,created_at,substr(extracted_text,1,700) excerpt FROM documents WHERE substr(created_at,1,7)=? ORDER BY created_at DESC LIMIT 8').all(currentMonth):[];
  if(documentQuery&&!documents.length)return res.json({answer:'No documents were processed this month in this workspace.',source:'calculated'});
  try { res.json({answer:await answerDocumentQuestion(question,{invoices:relevant,documents}),source:'ollama'}); } catch(e){safeError(res,e,503);}
});
app.post('/api/assistant/reminder', async (req,res) => {
  const invoice=getInvoices().find(i=>i.id===req.body?.invoice_id); if(!invoice)return res.status(404).json({error:'Saved invoice not found.'});
  try { res.json({draft:await generatePaymentReminder(invoice)}); }catch(e){safeError(res,e,503);}
});

app.get('/api/reports/summary', (_req,res) => {
  const invoices=getInvoices(); const monthly=db.prepare(`SELECT substr(issue_date,1,7) month,currency,SUM(total_minor) total_minor,COUNT(*) count FROM invoices GROUP BY month,currency ORDER BY month DESC`).all();
  const clients=db.prepare(`SELECT COALESCE(c.name,i.client_name) client, i.currency, SUM(CASE WHEN i.status IN ('unpaid','overdue','disputed') THEN i.total_minor ELSE 0 END) balance_minor, COUNT(*) invoices FROM invoices i LEFT JOIN clients c ON c.id=i.client_id GROUP BY client,i.currency ORDER BY balance_minor DESC`).all();
  res.json({stats:calculateStats(invoices),monthly,clients,overdue:invoices.filter(i=>i.status==='overdue')});
});
app.get('/api/reports/export.csv', (_req,res) => {
  const rows=getInvoices(); const quote=v=>{const value=typeof v==='string'&&/^\s*[=+\-@\t\r]/.test(v)?`'${v}`:String(v ?? '');return `"${value.replaceAll('"','""')}"`;};
  const csv=['Invoice,Client,Issue date,Due date,Amount minor units,Currency,Status',...rows.map(i=>[i.number,i.client_name,i.issue_date,i.due_date,i.total_minor,i.currency,i.status].map(quote).join(','))].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="proofpocket-invoices.csv"'); res.send(csv);
});
app.get('/api/data/export.json', (_req,res) => res.json({exportedAt:now(),clients:db.prepare('SELECT * FROM clients').all(),documents:db.prepare('SELECT id,filename,mime_type,kind,status,extracted_text,created_at FROM documents').all(),invoices:getInvoices()}));
app.delete('/api/data', (_req,res) => { db.exec('DELETE FROM invoices; DELETE FROM documents; DELETE FROM clients;'); for(const f of fs.readdirSync(path.join(dir,'uploads')))fs.rmSync(path.join(dir,'uploads',f),{force:true}); res.status(204).end(); });

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(webDist, { index: false }));
app.get('*', (req,res,next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(webDist,'index.html'), error => error && next()));
app.use((err,_req,res,_next) => { console.error('Request failed.'); res.status(500).json({error:'Something went wrong while processing this request.'}); });
app.listen(PORT,'127.0.0.1',()=>console.log(`ProofPocket API listening on http://127.0.0.1:${PORT}`));
