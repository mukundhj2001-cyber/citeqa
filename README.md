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

### Optional fluent answers (Ollama preferred)

Without a local LLM or API key, CiteQA still retrieves chunks and quotes the top snippets (great for offline demos). **Embeddings never leave your machine** — generation is separate.

**Precedence:** weak retrieval → refuse · else **Ollama** (if reachable) · else **OpenAI** (if `OPENAI_API_KEY`) · else offline quotes.

```bash
# Privacy-first (recommended): install Ollama, pull a model, then run CiteQA
# https://ollama.com
ollama pull llama3.2
cp .env.example .env.local
# OLLAMA_BASE_URL=http://127.0.0.1:11434   # default
# OLLAMA_MODEL=llama3.2                    # default
npm run dev
```

Cloud fallback only when Ollama is down:

```bash
# OPENAI_API_KEY=sk-...
# optional: OPENAI_BASE_URL=...  OPENAI_MODEL=gpt-4o-mini
```

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
                         Ollama up?      → local LLM answer with [n] citations
                         else OPENAI key → cloud LLM (fallback)
                         else            → offline quote of top snippets
```

| Piece | Role |
|-------|------|
| `knowledge/` | Northstar FAQ, pricing/refunds, onboarding, troubleshooting |
| `src/lib/chunker.ts` | Section-aware markdown chunking |
| `src/lib/embeddings.ts` | Local Transformers.js MiniLM (no cloud embedding API) |
| `src/lib/vectorstore.ts` | Persistent vectors + cosine search |
| `src/lib/knowledge.ts` | `ensureIndex()` — load disk index or rebuild |
| `src/lib/generate.ts` | Weak-retrieval gate + Ollama → OpenAI → offline |
| `src/lib/ollama.ts` | Local Ollama health + OpenAI-compatible chat client |
| `src/lib/rag.ts` | Orchestrates retrieve → generate → citations |
| `src/app/api/chat` | Chat endpoint |
| `src/app/api/health` | Index stats / Ollama reachability / generation mode |
| `src/components/ChatWidget.tsx` | Support-widget UI, citations, retrieval panel |
| `data/index/` | Persisted chunk metadata + Float32 vectors (gitignored) |
| `.cache/transformers/` | Downloaded ONNX model weights (gitignored) |

**Design choices**

- **Local semantic retrieval** — paraphrase-friendly cosine search; TF-IDF removed as the default path.
- **Disk-persisted index** — restarts reuse `data/index/` when the knowledge fingerprint (content hash + model id) is unchanged.
- **Privacy** — document text is never sent to an embedding API. Answer generation prefers **local Ollama**; OpenAI is generation-only fallback when Ollama is unreachable.
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


## Part C — Local Ollama (private answer generation)

Fluent answers without sending your help-center text to the cloud. CiteQA talks to a local [Ollama](https://ollama.com) server over `http://127.0.0.1:11434` (OpenAI-compatible `/v1/chat/completions`).

### Why this matters

- **Embeddings** were already local (Part A).
- **Generation** can now stay local too: retrieved chunks go to Ollama on your laptop, not to OpenAI.
- Same grounding rules: answer only from context, cite `[n]`, refuse when retrieval is weak.

### Install & pull a model

```bash
# macOS / Windows / Linux — see https://ollama.com/download
# After install, pull a small chat model (examples):
ollama pull llama3.2
# or: ollama pull mistral
# or: ollama pull qwen2.5:3b
```

Confirm the daemon is up:

```bash
curl http://127.0.0.1:11434/api/tags
```

### Env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama server |
| `OLLAMA_MODEL` | `llama3.2` | Chat model name (must be pulled) |
| `OPENAI_API_KEY` | _(empty)_ | Used **only** if Ollama is unreachable |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | OpenAI defaults | Optional cloud overrides |

Copy `.env.example` → `.env.local` and adjust if needed. Restart `npm run dev` after changes.

### Generation precedence

1. **Weak retrieval** → refuse (unchanged; no LLM call).
2. **Ollama reachable** → generate locally (docs stay private).
3. Else if **`OPENAI_API_KEY` set** → OpenAI-compatible cloud chat.
4. Else → **offline** grounded quotes of top snippets.

If Ollama is up but the chat call fails (missing model, timeout), CiteQA falls through to OpenAI (if keyed) or offline quotes — it does not crash.

### Health check

`GET /api/health` reports:

- `ollama` — boolean reachability
- `openai` — whether an API key is configured
- `generationMode` — `ollama` | `openai` | `offline`
- `ollamaModel` / `ollamaBaseUrl`

The chat header shows a short mode hint (e.g. `Ollama (llama3.2)`).

### Windows laptop smoke test

1. Install Ollama from https://ollama.com/download and run `ollama pull llama3.2`.
2. In the CiteQA folder: `npm install` → `npm run seed` → `npm run dev`.
3. Open http://localhost:3000 — header should say **Ollama (llama3.2)** (or your model).
4. Ask “How do refunds work?” — expect a fluent answer with `[n]` citations and mode **Ollama (local) + citations**.
5. Quit Ollama (or stop the service) and refresh — mode falls back to OpenAI (if keyed) or **offline quotes**; chat still works.
6. Ask an out-of-corpus question (“What’s your enterprise HIPAA SLA?”) — still refuses.

### Gotchas

- Pull the model before first chat (`ollama pull <name>`); otherwise generation fails and CiteQA falls back.
- First Ollama reply can be slow while the model loads into RAM.
- Firewall / WSL: if CiteQA runs in WSL2 and Ollama on Windows, you may need to point `OLLAMA_BASE_URL` at the Windows host IP, not `127.0.0.1`.
- Document uploads and embeddings never call Ollama or OpenAI for vectors — only the **answer** step uses a chat model.

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
│   └── lib/                # RAG + Ollama + uploads + vectorstore
├── .env.example
└── README.md
```

## How I’d pitch this on Upwork

> I’ll build a support chatbot that answers **only from your help center**, with **clickable citations** so agents and customers can verify every claim. Weak matches refuse instead of hallucinating refund or pricing policy — critical for trust.
>
> Stack: Next.js + TypeScript, **local** embeddings + persistent vector index, **Ollama-first** private generation (OpenAI fallback). Deliverables: chat widget UI, indexed docs, retrieval debug panel, and a short handoff README so your team can swap in real articles.
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
