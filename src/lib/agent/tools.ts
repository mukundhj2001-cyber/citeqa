/**
 * Local / demo-safe tools for the Premium support agent.
 * All side effects write under data/ (tickets, CSV log, knowledge gaps).
 */
import { ensureIndex } from "@/lib/knowledge";
import { getStore } from "@/lib/vectorstore";
import { isWeakRetrieval } from "@/lib/generate";
import {
  appendActionLog,
  createTicket,
  escalateTicket,
  recordKnowledgeGap,
  type TicketCitation,
} from "@/lib/actions-store";
import type { Citation, RetrievalHit } from "@/lib/types";
import type { AgentToolCall, AgentToolName, AgentContext } from "./types";
import type { ToolTraceEntry } from "@/lib/action-types";

function snippetOf(text: string, max = 220): string {
  const cleaned = text.replace(/^#+\s+.+$/m, "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

export const TOOL_DEFINITIONS: Array<{
  type: "function";
  function: {
    name: AgentToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: "function",
    function: {
      name: "search_docs",
      description:
        "Look up Cyberfield help-center articles for the customer's question. Call this before answering factual or policy questions. Results are for your reasoning only — never paste them as a chunk list in the customer reply.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          top_k: { type: "integer", description: "How many articles to consider (default 6)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ticket",
      description:
        "Create a support ticket with the customer question, a short summary, and citations from search_docs.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" },
          question: { type: "string" },
          summary: { type: "string", description: "Short grounded summary for the ticket body" },
        },
        required: ["question", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_ticket",
      description:
        "Create or update a ticket with status escalated and priority high. Pass ticket_id to update an existing ticket.",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          subject: { type: "string" },
          question: { type: "string" },
          summary: { type: "string" },
        },
        required: ["question", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_crm_note",
      description: "Append a CRM / action-log note (CSV sheet on disk).",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          note: { type: "string" },
        },
        required: ["question", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notify_team",
      description:
        "Notify the support team via WEBHOOK_URL if set; otherwise simulate success and log locally.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          message: { type: "string", description: "Notification payload / reason" },
          severity: { type: "string", enum: ["info", "high"] },
        },
        required: ["question", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_knowledge_gap",
      description:
        "Log a topic the docs cannot answer (e.g. HIPAA SLA). Use when search is weak / refuse path.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          question: { type: "string" },
        },
        required: ["topic", "question"],
      },
    },
  },
];

function toTicketCitations(citations: Citation[]): TicketCitation[] {
  return citations.slice(0, 8).map((c) => ({
    docTitle: c.docTitle,
    section: c.section,
    rank: c.rank,
    score: c.score,
  }));
}

async function toolSearchDocs(
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<{ ok: boolean; result: unknown }> {
  const query =
    typeof args.query === "string" && args.query.trim()
      ? args.query.trim()
      : ctx.message;
  const topK =
    typeof args.top_k === "number" && args.top_k > 0
      ? Math.min(10, Math.floor(args.top_k))
      : 6;

  await ensureIndex();
  const store = getStore();
  const hits = await store.search(query, topK);
  const weak = isWeakRetrieval(hits);

  const retrieval: RetrievalHit[] = hits.map((h) => ({
    id: h.id,
    docTitle: h.docTitle,
    section: h.section,
    snippet: snippetOf(h.text, 180),
    score: Number(h.score.toFixed(4)),
    rank: h.rank,
  }));

  const citations: Citation[] = weak
    ? []
    : hits.slice(0, 3).map((h) => ({
        chunkId: h.id,
        docTitle: h.docTitle,
        section: h.section,
        snippet: snippetOf(h.text),
        score: Number(h.score.toFixed(4)),
        rank: h.rank,
      }));

  ctx.retrieval = retrieval;
  ctx.citations = citations;
  ctx.searchWeak = weak;
  ctx.refused = weak;

  return {
    ok: true,
    result: {
      weak,
      topScore: hits[0] ? Number(hits[0].score.toFixed(4)) : 0,
      chunks: retrieval.map((r) => ({
        rank: r.rank,
        docTitle: r.docTitle,
        section: r.section,
        score: r.score,
        snippet: r.snippet,
      })),
    },
  };
}

function toolCreateTicket(
  args: Record<string, unknown>,
  ctx: AgentContext
): { ok: boolean; result: unknown } {
  const question =
    (typeof args.question === "string" && args.question.trim()) || ctx.message;
  const summary =
    (typeof args.summary === "string" && args.summary.trim()) ||
    ctx.lastAnswer ||
    "Customer requested support follow-up.";
  const subject =
    (typeof args.subject === "string" && args.subject.trim()) ||
    `Support: ${question.slice(0, 80)}`;

  const citeLines = ctx.citations
    .map((c) => `[${c.rank}] ${c.docTitle} — ${c.section}`)
    .join("\n");
  const body = [
    `Customer question:\n${question}`,
    "",
    `Grounded answer summary:\n${summary.slice(0, 1500)}`,
    "",
    citeLines ? `Source citations:\n${citeLines}` : "Source citations: (none)",
  ].join("\n");

  const ticket = createTicket({
    subject,
    body,
    question,
    answerSummary: summary.slice(0, 1500),
    citations: toTicketCitations(ctx.citations),
  });

  appendActionLog({
    question,
    action: "Create support ticket",
    result: "Success",
    detail: `Opened a support ticket and marked it open. Created by the agent.`,
  });

  return { ok: true, result: { ticketId: ticket.id, status: ticket.status } };
}

function toolEscalate(
  args: Record<string, unknown>,
  ctx: AgentContext
): { ok: boolean; result: unknown } {
  const question =
    (typeof args.question === "string" && args.question.trim()) || ctx.message;
  const summary =
    (typeof args.summary === "string" && args.summary.trim()) ||
    ctx.lastAnswer ||
    "Escalated by support agent.";
  const subject =
    (typeof args.subject === "string" && args.subject.trim()) ||
    `Escalated: ${question.slice(0, 80)}`;
  const ticketId =
    typeof args.ticket_id === "string" ? args.ticket_id.trim() : undefined;

  const citeLines = ctx.citations
    .map((c) => `[${c.rank}] ${c.docTitle} — ${c.section}`)
    .join("\n");
  const body = [
    `Customer question:\n${question}`,
    "",
    `Escalation summary:\n${summary.slice(0, 1500)}`,
    "",
    citeLines ? `Source citations:\n${citeLines}` : "Source citations: (none)",
  ].join("\n");

  const ticket = escalateTicket({
    ticketId: ticketId || undefined,
    subject,
    body,
    question,
    answerSummary: summary.slice(0, 1500),
    citations: toTicketCitations(ctx.citations),
  });

  appendActionLog({
    question,
    action: "Escalate ticket",
    result: "Success",
    detail: `Escalated the ticket to high priority so a human can follow up. Created by the agent.`,
  });

  return {
    ok: true,
    result: {
      ticketId: ticket.id,
      status: ticket.status,
      priority: ticket.priority,
    },
  };
}

function toolLogCrm(
  args: Record<string, unknown>,
  ctx: AgentContext
): { ok: boolean; result: unknown } {
  const question =
    (typeof args.question === "string" && args.question.trim()) || ctx.message;
  const note =
    (typeof args.note === "string" && args.note.trim()) ||
    "Agent CRM note";

  const entry = appendActionLog({
    question,
    action: "Log CRM note",
    result: "Success",
    detail: note.slice(0, 500),
  });

  return { ok: true, result: { logged: true, timestamp: entry.timestamp } };
}

async function toolNotifyTeam(
  args: Record<string, unknown>,
  ctx: AgentContext
): Promise<{ ok: boolean; result: unknown }> {
  const question =
    (typeof args.question === "string" && args.question.trim()) || ctx.message;
  const message =
    (typeof args.message === "string" && args.message.trim()) ||
    "Team notification from CiteQA agent";
  const severity =
    typeof args.severity === "string" ? args.severity : "info";

  const payload = {
    source: "citeqa-agent",
    event: "notify_team",
    question,
    message: message.slice(0, 2000),
    severity,
    citations: ctx.citations.slice(0, 8),
    at: new Date().toISOString(),
  };

  const webhookUrl = process.env.WEBHOOK_URL?.trim();
  let result = "Saved locally only";
  let detail =
    "No team webhook is configured, so the alert was saved in the local action log only.";
  let statusCode: number | null = null;

  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      statusCode = res.status;
      result = res.ok ? "Success" : "Failed";
      detail = res.ok
        ? `Team alert sent successfully (HTTP ${res.status}).`
        : `Team alert failed (HTTP ${res.status}).`;
    } catch (e) {
      result = "Failed";
      detail = e instanceof Error
        ? `Team alert could not be sent: ${e.message}`
        : "Team alert could not be sent.";
    }
  }

  appendActionLog({
    question,
    action: "Notify team",
    result,
    detail: `${detail} Message: ${message.slice(0, 200)}`,
  });

  return {
    ok: result === "Success" || result === "Saved locally only",
    result: { result, detail, statusCode, simulated: !webhookUrl },
  };
}

function toolKnowledgeGap(
  args: Record<string, unknown>,
  ctx: AgentContext
): { ok: boolean; result: unknown } {
  const question =
    (typeof args.question === "string" && args.question.trim()) || ctx.message;
  const topic =
    (typeof args.topic === "string" && args.topic.trim()) ||
    "unknown_topic";

  const gap = recordKnowledgeGap({ topic, question });
  appendActionLog({
    question,
    action: "Record knowledge gap",
    result: "Success",
    detail: `Logged a missing documentation topic for the content team: ${gap.topic}.`,
  });

  return { ok: true, result: { gapId: gap.id, topic: gap.topic } };
}

export async function executeTool(
  call: AgentToolCall,
  ctx: AgentContext
): Promise<ToolTraceEntry> {
  const started = Date.now();
  let out: { ok: boolean; result: unknown };

  try {
    switch (call.name) {
      case "search_docs":
        out = await toolSearchDocs(call.arguments, ctx);
        break;
      case "create_ticket":
        out = toolCreateTicket(call.arguments, ctx);
        break;
      case "escalate_ticket":
        out = toolEscalate(call.arguments, ctx);
        break;
      case "log_crm_note":
        out = toolLogCrm(call.arguments, ctx);
        break;
      case "notify_team":
        out = await toolNotifyTeam(call.arguments, ctx);
        break;
      case "record_knowledge_gap":
        out = toolKnowledgeGap(call.arguments, ctx);
        break;
      default:
        out = { ok: false, result: { error: `Unknown tool: ${call.name}` } };
    }
  } catch (e) {
    out = {
      ok: false,
      result: { error: e instanceof Error ? e.message : "tool failed" },
    };
  }

  return {
    name: call.name,
    args: call.arguments,
    result: out.result,
    ok: out.ok,
    ms: Date.now() - started,
  };
}

export function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { raw };
    }
  }
  return {};
}

export const TOOL_NAMES = new Set<string>(
  TOOL_DEFINITIONS.map((t) => t.function.name)
);
