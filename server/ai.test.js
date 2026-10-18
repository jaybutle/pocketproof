import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractDocumentFields, getOllamaStatus, explainMissingFields } from './ai.js';

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();delete process.env.OLLAMA_URL;delete process.env.OLLAMA_MODEL});

describe('Ollama adapter',()=>{
  it('reports unavailable runtime without pretending the model is installed',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    const status=await getOllamaStatus();
    expect(status).toMatchObject({reachable:false,installed:false,model:'gemma3:1b'});
  });
  it('requires the configured model to be installed',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({models:[{name:'other:latest'}]})}));
    expect(await getOllamaStatus()).toMatchObject({reachable:true,installed:false});
  });
  it('rejects malformed model JSON instead of treating it as extracted facts',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:'not-json'}})}));
    await expect(extractDocumentFields('Invoice text')).rejects.toThrow('malformed JSON');
  });
  it('rejects untrusted non-loopback Ollama endpoints',async()=>{
    process.env.OLLAMA_URL='https://example.com';
    vi.stubGlobal('fetch',vi.fn());
    expect((await getOllamaStatus()).error).toContain('must be local');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('validates structured responses and normalizes missing evidence as null',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({message:{content:JSON.stringify({kind:'invoice',number:null,client_name:'Northwind',issue_date:null,due_date:null,subtotal_minor:null,tax_minor:null,total_minor:12500,currency:'USD',payment_status:null,warnings:['Due date is missing']})}})}));
    const result=await extractDocumentFields('Northwind invoice amount $125.00');
    expect(result).toMatchObject({kind:'invoice',client_name:'Northwind',number:null,total_minor:12500,due_date:null});
  });
  it('explains absent fields so a reviewer knows what still needs confirmation',()=>{
    expect(explainMissingFields({number:null,client_name:'Northwind',issue_date:null,due_date:null,total_minor:0,currency:null})).toEqual(['Document number was not found and needs review.','Issue date was not found and needs review.','Due date was not found and needs review.','Currency was not found and needs review.']);
  });
  it('surfaces an inference timeout instead of returning a fabricated extraction',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))));
    const pending=extractDocumentFields('Invoice text');
    const assertion=expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(90001);
    await assertion;
    vi.useRealTimers();
  });
});
