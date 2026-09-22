# CiteQA — Premium end-to-end product

**Private RAG support chatbot with citations, agent actions, and an admin audit trail.**

Portfolio / Fiverr-style demo you can open and understand in ~2 minutes: marketing packages → live grounded chat → Premium agent actions → admin logs. Embeddings stay local (MiniLM). Generation is **Ollama-first**. **OpenAI is not required.**

![Stack](https://img.shields.io/badge/Next.js-App%20Router-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Privacy](https://img.shields.io/badge/Embeddings-local%20MiniLM-emerald)

## Packages (gig tiers)

| Tier | What the buyer gets |
|------|---------------------|
| **Basic** | RAG Q&A on docs · clickable citations · refuse-when-unknown · local MiniLM embeddings |
| **Standard** | + upload / re-index (.md · .txt · .pdf) · eval suite · private Ollama-first generation |
| **Premium** | + agent actions (create ticket · log to sheet/CSV · webhook) · admin dashboard · decision / audit trail |

The live `/demo` defaults to **Premium**. Use the package switcher to preview Basic/Standard (agent panel dims on Basic).

## Quick start

```bash
cd citeqa
npm install
npm run seed           # build local embeddings + persist vector index
npm run dev
```

| Route | Purpose |
|-------|---------|
| [http://localhost:3000](http://localhost:3000) | Marketing landing + package cards |
| [http://localhost:3000/demo](http://localhost:3000/demo) | Live RAG workspace + agent actions |
| [http://localhost:3000/admin](http://localhost:3000/admin) | Docs · tickets · action log · eval |

> **First seed / first chat:** Transformers.js downloads `Xenova/all-MiniLM-L6-v2` once into `.cache/transformers/`. After that, search is fully local. Disk index: `data/index/`.

## 60-second Fiverr demo path

1. Open `/` — show Basic / Standard / Premium cards.  
2. Click **Open live Premium demo** → `/demo`.  
3. Ask **“How do refunds work?”** — show citations + retrieval ranks.  
4. Click **Create support ticket** (and optionally **Log to sheet** / **Send webhook**).  
5. Open `/admin` → **Tickets** + **Action log**.  
6. (Optional) **Eval** tab → **Run eval in-app**, or terminal `npm run eval`.

Buyer takeaway: *grounded answers → actions with citations → auditable admin.*

## Environment

Copy `.env.example` → `.env.local` as needed. **None are required** for a working offline demo.

| Variable | Role |
|----------|------|
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Default `llama3.2` |
| `OPENAI_API_KEY` | Optional generation fallback only if Ollama is down |
| `WEBHOOK_URL` | Premium “Send webhook” target; if unset, action is **simulated** and logged locally |
| `ADMIN_DEMO_PASSWORD` | Optional simple gate for `/admin`; leave empty for open portfolio mode |

```bash
# Privacy-first fluent answers (recommended)
ollama pull llama3.2
cp .env.example .env.local
npm run dev
```

**Generation precedence:** weak retrieval → refuse · else Ollama · else OpenAI (if key) · else offline quotes.  
**Embeddings never leave the machine.**

## Scripts

```bash
npm run seed    # index knowledge/ + uploads → data/index/
npm run dev     # Next.js dev server
npm run build   # production build
npm run eval    # offline quality harness (evals/cases.json)
npm run smoke   # quick retrieval smoke test
```

## Product map

```
/                 Landing — hero, how it works, packages, CTA
/demo             ChatWidget + citations + Premium agent actions
/admin            Docs panel · tickets · action-log.csv · eval trigger

POST /api/chat                 RAG answer
POST /api/actions/ticket       → data/tickets.json + action log
POST /api/actions/log          → data/action-log.csv
POST /api/actions/webhook      → WEBHOOK_URL or simulate + log
GET  /api/tickets              list tickets
GET|POST /api/eval             last summary / run harness
```

## Architecture (privacy-first)

```
knowledge/*.md + knowledge/uploads/
      ↓ section-aware chunker
local MiniLM (@xenova/transformers)
      ↓ persist data/index/
question → cosine top-k → weak? refuse
                         ↓ strong
              Ollama → answer + [n] citations
              else offline quotes / optional OpenAI
                         ↓ Premium
         ticket JSON · CSV sheet · webhook + admin audit
```

| Piece | Role |
|-------|------|
| `src/lib/embeddings.ts` | Local MiniLM — no cloud embedding API |
| `src/lib/rag.ts` / `generate.ts` / `ollama.ts` | Retrieve → generate (Ollama-first) |
| `src/lib/actions-store.ts` | Tickets JSON + CSV action log |
| `src/lib/eval-harness.ts` | Shared by `npm run eval` and `POST /api/eval` |
| `src/lib/packages.ts` | Basic / Standard / Premium definitions |
| `src/components/ChatWidget.tsx` | Chat + citations + retrieval |
| `src/components/AgentPanel.tsx` | Premium action buttons |
| `data/tickets.json` | Support tickets created from grounded answers |
| `data/action-log.csv` | Audit trail (timestamp, question, action, result) |

## What to try

| Question | Expected |
|----------|----------|
| “How do refunds work?” | Grounded answer + Pricing & Billing citations |
| “Can I get my money back?” | Semantic paraphrase match |
| “What’s your enterprise HIPAA SLA?” | Clean refuse |

## Design choices

- **Local semantic retrieval** — paraphrase-friendly cosine search.  
- **Refuse when unknown** — never invent support policy.  
- **Agent actions only on grounded answers** — refused turns keep actions locked.  
- **No OpenAI required** for demos, eval, or agent persistence.  
- **Light admin** — demo banner / optional `ADMIN_DEMO_PASSWORD`; portfolio-friendly.

## License

Portfolio sample. Adapt for client delivery as needed.
