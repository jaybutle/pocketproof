import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore, invoiceStatus, calculateStats } from './store.js';

const tempDirs=[];
afterEach(()=>{for(const dir of tempDirs.splice(0))fs.rmSync(dir,{recursive:true,force:true})});

describe('local SQLite data and finance rules',()=>{
  it('creates a local SQLite schema with client, invoice, and document relationships',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'proofpocket-'));tempDirs.push(dir);
    const {db}=createStore(dir);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(x=>x.name),['clients','documents','invoices']);
    db.close();
  });
  it('marks only unpaid past-due invoices overdue and preserves paid, draft, and disputed statuses',()=>{
    assert.equal(invoiceStatus({status:'unpaid',due_date:'2026-10-01'},'2026-10-02'),'overdue');
    assert.equal(invoiceStatus({status:'unpaid',due_date:'2026-10-02'},'2026-10-02'),'unpaid');
    assert.equal(invoiceStatus({status:'paid',due_date:'2020-01-01'},'2026-10-02'),'paid');
    assert.equal(invoiceStatus({status:'draft',due_date:'2020-01-01'},'2026-10-02'),'draft');
    assert.equal(invoiceStatus({status:'disputed',due_date:'2020-01-01'},'2026-10-02'),'disputed');
  });
  it('calculates exact minor-unit totals and keeps currencies separated',()=>{
    const stats=calculateStats([
      {status:'paid',due_date:'2026-10-01',total_minor:1299,currency:'USD'},
      {status:'unpaid',due_date:'2026-09-30',total_minor:4500,currency:'USD'},
      {status:'unpaid',due_date:'2026-11-02',total_minor:700,currency:'EUR'}
    ],'2026-10-01');
    assert.deepEqual({totalMinor:stats.totalMinor,paidMinor:stats.paidMinor,outstandingMinor:stats.outstandingMinor,overdueMinor:stats.overdueMinor,invoiceCount:stats.invoiceCount},{totalMinor:6499,paidMinor:1299,outstandingMinor:5200,overdueMinor:4500,invoiceCount:3});
    assert.deepEqual(stats.byCurrency,[
      {currency:'USD',totalMinor:5799,paidMinor:1299,overdueMinor:4500,outstandingMinor:4500,invoiceCount:2},
      {currency:'EUR',totalMinor:700,paidMinor:0,overdueMinor:0,outstandingMinor:700,invoiceCount:1}
    ]);
  });
});
