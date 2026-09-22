# CiteQA — Premium end-to-end product

**Private RAG support chatbot with citations, an autonomous tool-calling agent, and an admin audit trail.**

Portfolio / Fiverr-style demo you can open and understand in ~2 minutes: marketing packages → live grounded chat → Premium **agent mode** (multi-step tools + tool trace) → admin logs. Embeddings stay local (MiniLM). Generation / agent loop is **Ollama-first**. **OpenAI is not required.**

![Stack](https://img.shields.io/badge/Next.js-App%20Router-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Privacy](https://img.shields.io/badge/Embeddings-local%20MiniLM-emerald)

## Packages (gig tiers)

| Tier | What the buyer gets |
|------|---------------------|
| **Basic** | RAG Q&A on docs · clickable citations · refuse-when-unknown · local MiniLM embeddings |
| **Standard** | + upload / re-index (.md · .txt · .pdf) · eval suite · private Ollama-first generation |
| **Premium** | + **autonomous tool-calling support agent** · RAG · admin · transparent tool trace · optional manual actions |

The live `/demo` defaults to **Premium** with **Agent mode** on. Use the package switcher to preview Basic/Standard.

## Agent vs classic / manual actions

| Mode | Endpoint | Behavior |
|------|----------|----------|
| **Agent (Premium default)** | `POST /api/agent` | Multi-step loop: `search_docs` → answer with citations → call tools when intent needs action (`create_ticket`, `notify_team`, `escalate_ticket`, `log_crm_note`, `record_knowledge_gap`). UI shows a **tool trace**. |
| **Classic chat** | `POST /api/chat` | Single-turn RAG answer only (unchanged). |
| **Manual tools** | `/api/actions/*` | Optional buttons after a grounded answer (ticket / CSV log / webhook) — still available as secondary controls. |

**Why no LangChain?** A small custom ReAct / OpenAI-compatible tool loop in `src/lib/agent/` is enough, keeps dependencies light, and makes the tool trace easy to audit. Ollama `/v1/chat/completions` with `tools` when the model supports it; otherwise JSON-plan or a robust **heuristic planner** so demos work offline.

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
| [http://localhost:3000/demo](http://localhost:3000/demo) | Live RAG workspace + Premium agent |
| [http://localhost:3000/admin](http://localhost:3000/admin) | Docs · tickets · action log · eval |

> **First seed / first chat:** Transformers.js downloads `Xenova/all-MiniLM-L6-v2` once into `.cache/transformers/`. After that, search is fully local. Disk index: `data/index/`.

## 60-second Fiverr demo path

1. Open `/` — show Basic / Standard / Premium cards.  
2. Click **Open live Premium demo** → `/demo` (Agent mode on).  
3. Ask **“What’s the refund policy?”** — search + cited answer (tool trace shows `search_docs`).  
4. Ask **“I want a refund, create a ticket and notify the team”** — search + `create_ticket` + `notify_team`.  
5. Ask **“What’s your HIPAA SLA?”** — weak search → `record_knowledge_gap` + polite refuse.  
6. Open `/admin` → **Tickets** + **Action log**.  
7. (Optional) Toggle **Classic chat** or expand **manual tools**; run **Eval** in admin.

Buyer takeaway: *autonomous grounded agent → tool trace → auditable admin.*

## Environment

Copy `.env.example` → `.env.local` as needed. **None are required** for a working offline demo.

| Variable | Role |
|----------|------|
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Default `llama3.2` (tool-capable models preferred) |
| `OPENAI_API_KEY` | Optional generation / agent fallback only if Ollama is down |
| `WEBHOOK_URL` | `notify_team` / “Send webhook” target; if unset, **simulated** + logged locally |
| `ADMIN_DEMO_PASSWORD` | Optional simple gate for `/admin`; leave empty for open portfolio mode |

```bash
# Privacy-first fluent answers + agent (recommended)
ollama pull llama3.2
cp .env.example .env.local
npm run dev
```

**Generation / agent precedence:** Ollama (tools → JSON plan → heuristic) → OpenAI tools (if key) → heuristic offline.  
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
/demo             ChatWidget · Agent mode · tool trace · manual tools
/admin            Docs · tickets · action-log.csv · eval

POST /api/chat                 Classic RAG answer
POST /api/agent                Premium tool-calling agent
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
                 ┌── Classic: POST /api/chat → answer + citations
question ────────┤
                 └── Agent:  POST /api/agent
                        ↓ max 6 steps
              tools: search_docs · create_ticket · escalate_ticket
                     log_crm_note · notify_team · record_knowledge_gap
                        ↓
              final answer + citations + toolTrace → UI
```

| Piece | Role |
|-------|------|
| `src/lib/embeddings.ts` | Local MiniLM — no cloud embedding API |
| `src/lib/rag.ts` / `generate.ts` / `ollama.ts` | Retrieve → generate (Ollama-first) |
| `src/lib/agent/` | Tool defs, executor, `runSupportAgent` (no LangChain) |
| `src/lib/actions-store.ts` | Tickets JSON · CSV log · knowledge gaps |
| `src/lib/packages.ts` | Basic / Standard / Premium definitions |
| `src/components/ChatWidget.tsx` | Chat + Agent / Classic toggle |
| `src/components/AgentPanel.tsx` | Tool trace + optional manual tools |
| `data/tickets.json` | Support tickets (incl. escalated / high) |
| `data/action-log.csv` | Audit trail |
| `data/knowledge-gaps.json` | Topics the docs could not answer |

## Agent tools (all local / demo-safe)

| Tool | Effect |
|------|--------|
| `search_docs` | RAG top chunks + scores |
| `create_ticket` | `data/tickets.json` + log |
| `escalate_ticket` | status `escalated`, priority `high` |
| `log_crm_note` | append `data/action-log.csv` |
| `notify_team` | `WEBHOOK_URL` or simulate + log |
| `record_knowledge_gap` | `data/knowledge-gaps.json` when info missing |

## What to try

| Question | Expected |
|----------|----------|
| “What’s the refund policy?” | `search_docs` + grounded answer |
| “I want a refund, create a ticket and notify the team” | search + `create_ticket` + `notify_team` + answer |
| “What’s your enterprise HIPAA SLA?” | weak search → `record_knowledge_gap` + refuse |

## Design choices

- **Local semantic retrieval** — paraphrase-friendly cosine search.  
- **Refuse when unknown** — never invent support policy; agent may log a knowledge gap.  
- **Agent tools + classic chat** — Premium adds autonomy without breaking `/api/chat` or eval.  
- **No OpenAI required** for demos, eval, or agent persistence.  
- **Light admin** — demo banner / optional `ADMIN_DEMO_PASSWORD`; portfolio-friendly.

## License

Portfolio sample. Adapt for client delivery as needed.
