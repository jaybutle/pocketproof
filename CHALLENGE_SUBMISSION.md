# ProofPocket AI — Hacktoberfest Open-Source AI Challenge: Week 2

**Tagline:** Your paperwork. Your AI. Your device.

## What I built

ProofPocket AI is a local-first invoice and paperwork workspace for independent workers. It extracts text from PDFs and images, asks Gemma 3 1B through Ollama for structured document suggestions, and requires a human review before any invoice is saved. Receipts and quotations remain in the document archive unless the user changes their classification. It tracks clients, invoices, payment states, due dates, exports, and record-grounded questions.

## The problem and who could pay

Freelancers, independent developers and designers, consultants, and small businesses spend time sorting paperwork and following up on unpaid invoices. A freelancer or small business could pay for managed setup, business support, or optional team workflows. No customers, payments, or willingness-to-pay have been verified.

## How it works

The React/Vite interface talks to a loopback Express API. better-sqlite3 stores clients, documents, and approved invoices on the user's computer. PDF text parsing and Tesseract.js image OCR run in the local process. The API sends bounded text to the configured loopback Ollama endpoint and validates structured JSON before presenting it. The user reviews and corrects every field. Application code calculates monetary totals and overdue status. Payment reminders are editable drafts; ProofPocket does not send email.

## Open-weight model and tools

- Gemma 3 1B through Ollama for local classification, extraction, open-ended answers, and reminder drafts.
- React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, Zod, Recharts, and Lucide React.
- Express, better-sqlite3, Multer, PDF parsing, and Tesseract.js.

## Why open innovation matters here

Client paperwork contains commercially sensitive information. Running an open-weight model locally avoids sending the document text to a third-party AI provider and avoids per-request model charges. Users can choose their local model and keep the database and uploaded source files in their own workspace. Hosted models may be more capable and easier to operate; the trade-off here is model setup, local hardware limits, and the need to verify every suggestion.

## Tests and current verification

- `npm test`: **15 automated checks passed** (8 Vitest checks and 7 Node checks). Ollama calls are mocked in automated tests.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; dashboard chart is a separate lazy-loaded bundle.
- Loopback smoke check passed for API health, sample-data dashboard values, overdue status, client currency balances, CSV export, and deleting the temporary sample records.
- A synthetic invoice was manually sent through the local extraction adapter using the installed Gemma 3 4B model; it returned the expected invoice number, client, dates, USD amount, and unpaid status. The app's default Gemma 3 1B is not installed here, and the complete browser upload-to-review flow still needs a manual run.

## Links and feedback

- **Demo:** Vercel static preview configured in the repository; a live URL will be added after importing the repo into the Vercel account.
- **Repository:** https://github.com/jaybutle/pocketproof
- **Run the fictional read-only preview locally:** `npm run dev:demo` (after `npm install`).
- **User feedback:** No external user feedback has been collected.
- **Business results:** No customers or revenue have been recorded.

## Challenge tag

`#hf26challenge`

The Week 2 Side Hustle submission window closes October 18, 2026 at 11:59 PM PDT (October 19 at 12:29 PM Asia/Kolkata). This file is a local submission draft; it has not been published.
