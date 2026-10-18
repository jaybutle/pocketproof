import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSchema,clientSchema,documentReviewSchema } from './schemas.js';
import { supportedMimeTypes,hasSupportedSignature } from './upload-validation.js';

describe('server-side request validation',()=>{
  it('validates invoice amounts as nonnegative integer minor units',()=>{
    const valid=invoiceSchema.safeParse({client_name:'Client A',total_minor:1250});
    assert.equal(valid.success,true);
    assert.equal(valid.data.currency,'USD');
    assert.equal(invoiceSchema.safeParse({client_name:'Client A',total_minor:12.5}).success,false);
    assert.equal(invoiceSchema.safeParse({client_name:'Client A',total_minor:-1}).success,false);
    assert.equal(invoiceSchema.safeParse({client_name:'Client A',total_minor:1,currency:'123'}).success,false);
  });
  it('requires useful client names and valid optional emails',()=>{
    assert.equal(clientSchema.safeParse({name:'  '}).success,false);
    assert.equal(clientSchema.safeParse({name:'Studio',email:'invalid'}).success,false);
    assert.equal(clientSchema.safeParse({name:' Studio ',email:''}).data.name,'Studio');
  });
  it('accepts only supported document review categories and valid dates',()=>{
    const base={kind:'receipt',fields:{number:null,client_name:null,issue_date:null,due_date:null,currency:null,total_minor:null,status:null,notes:''}};
    assert.equal(documentReviewSchema.safeParse(base).success,true);
    assert.equal(documentReviewSchema.safeParse({...base,kind:'unknown'}).success,false);
    assert.equal(documentReviewSchema.safeParse({...base,fields:{...base.fields,issue_date:'yesterday'}}).success,false);
  });
  it('matches all allowed MIME types against their file signatures',()=>{
    assert.deepEqual(supportedMimeTypes,['application/pdf','image/png','image/jpeg','image/webp']);
    assert.equal(hasSupportedSignature('application/pdf',Buffer.from('%PDF-1.7')),true);
    assert.equal(hasSupportedSignature('image/png',Buffer.from([137,80,78,71,13,10,26,10])),true);
    assert.equal(hasSupportedSignature('image/jpeg',Buffer.from([255,216,255,0])),true);
    assert.equal(hasSupportedSignature('image/webp',Buffer.from('RIFF0000WEBP')),true);
    assert.equal(hasSupportedSignature('image/png',Buffer.from('not png')),false);
    assert.equal(hasSupportedSignature('text/plain',Buffer.from('%PDF-')),false);
  });
});
