# CiteQA

**Support answers grounded in your docs.**

Portfolio demo of a customer-support knowledge chatbot with **RAG + citations**. Built as an Upwork/Fiverr-style sample for product analytics SaaS **Northstar Analytics** (fictional).

![Stack](https://img.shields.io/badge/Next.js-App%20Router-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

## Quick start

```bash
cd /workspace/citeqa   # or wherever you cloned this
npm install
npm run seed           # build local embeddings + persist vector index (recommended)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **First seed / first chat without a seed:** Transformers.js downloads `Xenova/all-MiniLM-L6-v2` into `.cache/transformers/` once (~few dozen MB). After that, embeddings and search are fully local and fast. The disk index under `data/index/` survives server restarts.

### Optional LLM answers

Without an API key, CiteQA still retrieves chunks and quotes the top snippets (great for offline demos). **Embeddings never call OpenAI** — the API key is only for answer generation.

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
| “Can I get my money back?” | Same refund chunks via **semantic** match (paraphrase) |
| “What’s on Pro?” | Plan features from docs |
| “How do I reset my password?” | Troubleshooting steps |
| “What’s your enterprise HIPAA SLA?” | Clean refuse — not in the corpus |

Starter chips appear on the empty chat state.

## Architecture (Part A — local semantic embeddings)

```
knowledge/*.md + knowledge/uploads/
      ↓ section-aware chunker
local MiniLM embeddings  (@xenova/transformers, Xenova/all-MiniLM-L6-v2)
      ↓
persist → data/index/{manifest.json, chunks.json, vectors.bin}
      ↓  (reload on startup if fingerprint still matches KB)
User question → embed locally → cosine top-k → weak? refuse
                                              ↓ strong
                         OPENAI_API_KEY? → LLM answer with [n] citations
                         else            → offline quote of top snippets
```

| Piece | Role |
|-------|------|
| `knowledge/` | Northstar FAQ, pricing/refunds, onboarding, troubleshooting |
| `src/lib/chunker.ts` | Section-aware markdown chunking |
| `src/lib/embeddings.ts` | Local Transformers.js MiniLM (no cloud embedding API) |
| `src/lib/vectorstore.ts` | Persistent vectors + cosine search |
| `src/lib/knowledge.ts` | `ensureIndex()` — load disk index or rebuild |
| `src/lib/generate.ts` | Weak-retrieval gate + OpenAI or offline compose |
| `src/lib/rag.ts` | Orchestrates retrieve → generate → citations |
| `src/app/api/chat` | Chat endpoint |
| `src/app/api/health` | Index stats / LLM flag |
| `src/components/ChatWidget.tsx` | Support-widget UI, citations, retrieval panel |
| `data/index/` | Persisted chunk metadata + Float32 vectors (gitignored) |
| `.cache/transformers/` | Downloaded ONNX model weights (gitignored) |

**Design choices**

- **Local semantic retrieval** — paraphrase-friendly cosine search; TF-IDF removed as the default path.
- **Disk-persisted index** — restarts reuse `data/index/` when the knowledge fingerprint (content hash + model id) is unchanged.
- **Privacy** — document text is never sent to an embedding API. Optional `OPENAI_API_KEY` is generation-only.
- **Answer only from context** — if top retrieval scores are weak, the bot refuses instead of inventing policy.
- **Citations** — doc title, section, snippet; clickable source panel.
- **Retrieval transparency** — ranked chunks with scores in the side panel.
- **No auth** — portfolio demo scope.

### Rebuild the index

```bash
npm run seed    # force re-embed knowledge/ → overwrite data/index/
# alias:
npm run index
```

Edit files under `knowledge/`, then run `npm run seed` again (or just chat — `ensureIndex()` rebuilds automatically when the fingerprint changes).


## Part B — Document upload & re-index

Add your own help articles; CiteQA re-chunks, re-embeds **locally** (same MiniLM path as Part A), and persists an updated `data/index/`. Uploaded document text is **never** sent to OpenAI for embeddings — optional `OPENAI_API_KEY` remains generation-only.

### How to upload

1. `npm run dev` → open the app → side panel **Docs** tab (or **Manage uploads** on mobile).
2. Drop or choose a `.md`, `.txt`, or `.pdf` (max **5 MB**).
3. CiteQA extracts text (PDFs via local `pdf-parse`), saves under `knowledge/uploads/`, then **re-indexes** automatically.
4. Ask a question only the new doc answers — citations should point at that upload.
5. **Delete** an upload from the list (re-indexes so it stops appearing). Use **Re-index** anytime to force a rebuild.

Sample Northstar docs in `knowledge/*.md` always load and stay read-only.

### API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/docs` | List sample + uploads, size limits |
| `POST` | `/api/docs/upload` | Multipart field `file` (+ optional `reindex=1`) |
| `DELETE` | `/api/docs/:id` | Remove an upload (`up-…` ids only) + re-index |
| `POST` | `/api/docs/reindex` | Force re-chunk / local re-embed / persist |

### Privacy

- Embeddings: **on-device** `Xenova/all-MiniLM-L6-v2` only.
- Uploads live on disk under `knowledge/uploads/` (gitignored except `.gitkeep`).
- Fingerprint includes upload content hashes so stale indexes are invalidated after add/delete.

### Layout (Part B)

```
knowledge/
├── *.md                 # Sample Northstar KB (committed)
└── uploads/             # User files + manifest.json (gitignored)
data/index/              # Rebuilt vectors after upload / re-index
src/app/api/docs/        # upload · list · delete · reindex
src/components/DocsPanel.tsx
src/lib/uploads.ts       # validation, PDF extract, registry
```

## Project layout

```
citeqa/
├── knowledge/              # Sample Northstar markdown KB
│   └── uploads/            # User uploads (gitignored; .gitkeep committed)
├── data/index/             # Persisted vectors (created by seed; gitignored)
├── .cache/transformers/    # Local model cache (gitignored)
├── scripts/seed.ts         # Force rebuild embeddings + print stats
├── src/
│   ├── app/                # App Router pages + API (/api/chat, /api/docs/…)
│   ├── components/         # ChatWidget + DocsPanel
│   └── lib/                # RAG + uploads + vectorstore
├── .env.example
└── README.md
```

## How I’d pitch this on Upwork

> I’ll build a support chatbot that answers **only from your help center**, with **clickable citations** so agents and customers can verify every claim. Weak matches refuse instead of hallucinating refund or pricing policy — critical for trust.
>
> Stack: Next.js + TypeScript, **local** embeddings + persistent vector index, OpenAI-compatible generation. Deliverables: chat widget UI, indexed docs, retrieval debug panel, and a short handoff README so your team can swap in real articles.
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
| `npm run seed` / `npm run index` | Rebuild local embeddings (sample + uploads) → `data/index/` |
| `npm run lint` | ESLint |

## License

Demo / portfolio use. Northstar Analytics is fictional.
