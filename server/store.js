import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createStore(dataDir = process.env.DATA_DIR || './data') {
  const dir = path.resolve(dataDir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true, mode: 0o700 });
  const databasePath=path.join(dir, 'proofpocket.sqlite');
  const db = new Database(databasePath);
  fs.chmodSync(databasePath, 0o600);
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, notes TEXT DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime_type TEXT NOT NULL, extracted_text TEXT DEFAULT '',
      kind TEXT DEFAULT 'other', status TEXT NOT NULL DEFAULT 'review', extraction_json TEXT,
      source_path TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, document_id TEXT UNIQUE REFERENCES documents(id) ON DELETE SET NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL, number TEXT, client_name TEXT NOT NULL,
      issue_date TEXT, due_date TEXT, currency TEXT NOT NULL DEFAULT 'USD', total_minor INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid', notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS invoices_due_idx ON invoices(due_date);
    CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS docs_created_idx ON documents(created_at);
  `);
  return { db, dir };
}

export function invoiceStatus(invoice, today = new Date().toISOString().slice(0, 10)) {
  if (invoice.status === 'paid' || invoice.status === 'disputed' || invoice.status === 'draft') return invoice.status;
  return invoice.due_date && invoice.due_date < today ? 'overdue' : 'unpaid';
}

export function calculateStats(invoices, today = new Date().toISOString().slice(0, 10)) {
  const records = invoices.map(i => ({ ...i, status: invoiceStatus(i, today) }));
  const base = records.reduce((acc, i) => {
    acc.totalMinor += i.total_minor || 0;
    if (i.status === 'paid') acc.paidMinor += i.total_minor || 0;
    if (i.status === 'overdue') acc.overdueMinor += i.total_minor || 0;
    if (['unpaid', 'overdue', 'disputed'].includes(i.status)) acc.outstandingMinor += i.total_minor || 0;
    return acc;
  }, { totalMinor: 0, paidMinor: 0, overdueMinor: 0, outstandingMinor: 0, invoiceCount: records.length });
  const grouped = new Map();
  for (const i of records) {
    const currency = i.currency || 'USD';
    const row = grouped.get(currency) || { currency, totalMinor: 0, paidMinor: 0, overdueMinor: 0, outstandingMinor: 0, invoiceCount: 0 };
    row.invoiceCount++;
    row.totalMinor += i.total_minor || 0;
    if (i.status === 'paid') row.paidMinor += i.total_minor || 0;
    if (i.status === 'overdue') row.overdueMinor += i.total_minor || 0;
    if (['unpaid','overdue','disputed'].includes(i.status)) row.outstandingMinor += i.total_minor || 0;
    grouped.set(currency, row);
  }
  return { ...base, byCurrency: [...grouped.values()] };
}
