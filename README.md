# Northstar Support (CiteQA)

Help-center assistant for **Northstar Analytics**: grounded support chat, related articles, tickets, and an operations console.

Customer-facing product UI lives at `/demo` (Help) and `/admin` (Operations). CiteQA is the implementation underneath.

---

## For the client

| Route | What it is |
|-------|------------|
| `/` | Product home |
| `/demo` | **Help chat** — answers from the help center, related articles, tickets when needed |
| `/admin` | **Operations** — tickets, activity, knowledge library, quality checks |

Typical walkthrough: open Help → ask about a refund → ask to open a ticket → check Operations.

---

## For developers

```bash
npm install
npm run seed           # build local embeddings + persist vector index
npm run dev            # http://localhost:3000
```

| Script | Purpose |
|--------|---------|
| `npm run seed` | Index `knowledge/` → `data/index/` |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run eval` | Offline quality harness |
| `npm run smoke` | Quick retrieval smoke test |

### Environment

Copy `.env.example` → `.env.local` as needed. **None are required** for a working local install.

| Variable | Role |
|----------|------|
| `OLLAMA_BASE_URL` | Default `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Default `llama3.2` |
| `OPENAI_API_KEY` | Optional fallback if Ollama is unavailable |
| `WEBHOOK_URL` | Team notification target; if unset, simulated + logged |
| `ADMIN_DEMO_PASSWORD` | Optional gate for `/admin` |

Embeddings stay local (MiniLM). Generation prefers Ollama.

### Architecture (short)

- `POST /api/chat` — single-turn grounded answer  
- `POST /api/agent` — multi-step tools (search, ticket, notify, escalate, gaps)  
- `src/lib/agent/` — tool loop (no LangChain)  
- `data/tickets.json`, `data/action-log.csv` — operations persistence  

---

## License

Delivered as a client product sample. Adapt for production as needed.
