import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './App';

afterEach(()=>{cleanup();vi.unstubAllGlobals()});

it('shows an onboarding state instead of invented dashboard figures for an empty workspace',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({totalMinor:0,paidMinor:0,overdueMinor:0,outstandingMinor:0,invoiceCount:0,documentsProcessed:0,sampleData:false,byCurrency:[],recent:[],upcoming:[],monthly:[]})}));
  render(<BrowserRouter><Dashboard ai={{reachable:false,model:'gemma3:1b',installed:false,models:[]}} toast={vi.fn()}/></BrowserRouter>);
  expect(await screen.findByText('Your workspace is ready')).toBeInTheDocument();
  expect(screen.queryByText('Recorded invoice total')).not.toBeInTheDocument();
  expect(screen.getByText(/INTERACTIVE SAMPLE/)).toBeInTheDocument();
});
