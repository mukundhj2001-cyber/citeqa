# CiteQA

**Support answers grounded in your docs.**

Portfolio demo of a customer-support knowledge chatbot with **RAG + citations**. Built as an Upwork/Fiverr-style sample for product analytics SaaS **Northstar Analytics** (fictional).

![Stack](https://img.shields.io/badge/Next.js-App%20Router-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Quick start

```bash
cd /workspace/citeqa   # or wherever you cloned this
npm install
npm run seed           # optional — indexes the markdown KB (also auto-runs on first chat)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional LLM answers

Without an API key, CiteQA still retrieves chunks and quotes the top snippets (great for offline demos).

```bash
cp .env.example .env.local
# set OPENAI_API_KEY=sk-...
# optional: OPENAI_BASE_URL=...  OPENAI_MODEL=gpt-4o-mini
npm run dev
```

Uses any OpenAI-compatible chat completions API.

## What to try

| Question | Expected |
|----------|----------|
| “How do refunds work?” | Grounded answer + citations from Pricing & Billing |
| “What’s on Pro?” | Plan features from docs |
| “How do I reset my password?” | Troubleshooting steps |
| “What’s your enterprise HIPAA SLA?” | Clean refuse — not in the corpus |

Starter chips appear on the empty chat state.

## Architecture

```
knowledge/*.md  →  chunk by ## sections  →  TF-IDF index (in-memory)
                                              ↓
User question  →  retrieve top-k + scores  →  weak? refuse
                                              ↓ strong
                         OPENAI_API_KEY? → LLM answer with [n] citations
                         else            → offline quote of top snippets
```

| Piece | Role |
|-------|------|
| `knowledge/` | Northstar FAQ, pricing/refunds, onboarding, troubleshooting |
| `src/lib/chunker.ts` | Section-aware markdown chunking |
| `src/lib/vectorstore.ts` | Local TF-IDF + cosine similarity (no paid vector DB) |
| `src/lib/generate.ts` | Weak-retrieval gate + OpenAI or offline compose |
| `src/lib/rag.ts` | Orchestrates retrieve → generate → citations |
| `src/app/api/chat` | Chat endpoint |
| `src/app/api/health` | Index stats / LLM flag |
| `src/components/ChatWidget.tsx` | Support-widget UI, citations, retrieval panel |

**Design choices**

- **Answer only from context** — if top retrieval scores are weak, the bot refuses instead of inventing policy.
- **Citations** — doc title, section, snippet; clickable source panel.
- **Retrieval transparency** — ranked chunks with scores in the side panel.
- **No auth** — portfolio demo scope.
- **Happy path** — `npm install && npm run dev` works without cloud infra.

## Project layout

```
citeqa/
├── knowledge/           # Sample Northstar Analytics markdown KB
├── scripts/seed.ts      # Build/print index stats
├── src/
│   ├── app/             # App Router pages + API
│   ├── components/      # Chat widget UI
│   └── lib/             # RAG pipeline
├── .env.example
└── README.md
```

## How I’d pitch this on Upwork

> I’ll build a support chatbot that answers **only from your help center**, with **clickable citations** so agents and customers can verify every claim. Weak matches refuse instead of hallucinating refund or pricing policy — critical for trust.
>
> Stack: Next.js + TypeScript, local or hosted embeddings/vector search, OpenAI-compatible generation. Deliverables: chat widget UI, indexed docs, retrieval debug panel, and a short handoff README so your team can swap in real articles.
>
> Similar to the CiteQA demo: ask “How do refunds work?” and get a grounded answer with source snippets; ask something outside the docs and get a clear “not in the knowledge base.”

**Typical engagement**

1. Ingest help center / Notion / Zendesk export  
2. Chunk + embed + tune refusal threshold  
3. Embed widget or share link for CS team pilot  
4. Optional: analytics on unanswered questions → content gaps  

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production |
| `npm run seed` | Index KB and print chunk counts |
| `npm run lint` | ESLint |

## License

Demo / portfolio use. Northstar Analytics is fictional.
