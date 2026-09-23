/**
 * Premium support agent — multi-step tool loop (privacy-first).
 *
 * Prefer Ollama OpenAI-compatible /v1/chat/completions with tools when the
 * model supports them; otherwise a robust JSON-plan fallback; if no LLM is
 * reachable, a heuristic planner still runs search + actions for demos.
 *
 * No LangChain — custom loop keeps deps light and behavior transparent.
 */
import {
  generateAnswer,
  isWeakRetrieval,
  hasOpenAI,
  sanitizeCustomerAnswer,
} from "@/lib/generate";
import {
  getOllamaModel,
  isOllamaReachable,
  getOllamaBaseUrl,
} from "@/lib/ollama";
import { ensureIndex } from "@/lib/knowledge";
import { getStore } from "@/lib/vectorstore";
import type { Citation, RetrievalHit, ScoredChunk } from "@/lib/types";
import type { AgentResult, AgentContext, AgentToolCall, AgentToolName } from "./types";
import {
  TOOL_DEFINITIONS,
  TOOL_NAMES,
  executeTool,
  parseToolArgs,
} from "./tools";
import type { ToolTraceEntry } from "@/lib/action-types";
import OpenAI from "openai";

const MAX_STEPS = 6;
const AGENT_TIMEOUT_MS = 90_000;

const SYSTEM_PROMPT = `You are Northstar Support, the help-center assistant for Northstar Analytics customers.
You have internal tools. Use them, then write ONLY the final customer-facing reply.

Rules:
1. ALWAYS call search_docs before answering any factual / policy question. Never invent policy.
2. If search is weak (weak=true or low scores), call record_knowledge_gap and politely refuse — do not invent answers.
3. When the user asks to create a ticket, request a refund follow-up, or notify the team, call matching tools (create_ticket, notify_team, escalate_ticket, log_crm_note) after searching.
4. Final reply = short customer answer only (a few sentences or bullets). Never mention tools, chunks, search, retrieval, scores, ranks, or “top results”.
5. Never paste search_docs output, chunk lists, or numbered snippet dumps into the customer reply.
6. Do not add [1][2][3]… footnotes or URL lists — the product UI shows related articles.
7. Keep a warm, clear support-widget tone.`;

function snippetOf(text: string, max = 220): string {
  const cleaned = text.replace(/^#+\s+.+$/m, "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max - 1) + "…" : cleaned;
}

function emptyCtx(message: string): AgentContext {
  return {
    message,
    citations: [],
    retrieval: [],
    lastAnswer: "",
    refused: false,
    searchWeak: false,
  };
}

function hitsToRetrieval(hits: ScoredChunk[]): RetrievalHit[] {
  return hits.map((h) => ({
    id: h.id,
    docTitle: h.docTitle,
    section: h.section,
    snippet: snippetOf(h.text, 180),
    score: Number(h.score.toFixed(4)),
    rank: h.rank,
  }));
}

function hitsToCitations(hits: ScoredChunk[], weak: boolean): Citation[] {
  if (weak) return [];
  return hits.slice(0, 3).map((h) => ({
    chunkId: h.id,
    docTitle: h.docTitle,
    section: h.section,
    snippet: snippetOf(h.text),
    score: Number(h.score.toFixed(4)),
    rank: h.rank,
  }));
}

/** Intent heuristics for offline / JSON-plan assist. */
export function detectIntent(message: string) {
  const m = message.toLowerCase();
  return {
    wantsTicket:
      /\b(create|open|file|make|raise)\b.*\b(ticket|case)\b/.test(m) ||
      /\bticket\b/.test(m) && /\b(create|open|please|want|need)\b/.test(m) ||
      /\bi want a refund\b/.test(m) ||
      /\brequest( a)? refund\b/.test(m),
    wantsNotify:
      /\bnotif(y|ication)\b/.test(m) ||
      /\b(alert|ping|tell|message)\b.*\b(team|support|staff)\b/.test(m) ||
      /\bnotify the team\b/.test(m),
    wantsEscalate:
      /\bescalat/.test(m) || /\bpriority\b.*\bhigh\b/.test(m) || /\burgent\b/.test(m),
    wantsCrmNote: /\b(log|crm|note|sheet)\b/.test(m) && /\b(crm|note|sheet|log)\b/.test(m),
    asksPolicy: true,
  };
}

/**
 * Heuristic multi-tool plan — always works without an LLM (demo-safe).
 * Guarantees search first; then actions from intent; gap on weak search.
 */
export function buildHeuristicPlan(message: string, searchWeak: boolean): AgentToolCall[] {
  const intent = detectIntent(message);
  const plan: AgentToolCall[] = [
    { name: "search_docs", arguments: { query: message, top_k: 6 } },
  ];

  if (searchWeak) {
    // searchWeak known only AFTER search — caller runs search first then may re-plan.
    // This branch used when re-planning after search.
    const topicGuess =
      /\bhipaa\b/i.test(message)
        ? "HIPAA / compliance SLA"
        : /\bsla\b/i.test(message)
          ? "SLA"
          : "unknown_topic";
    plan.push({
      name: "record_knowledge_gap",
      arguments: { topic: topicGuess, question: message },
    });
    return plan;
  }

  if (intent.wantsTicket || intent.wantsEscalate) {
    if (intent.wantsEscalate) {
      plan.push({
        name: "escalate_ticket",
        arguments: {
          question: message,
          summary: `Escalated customer request: ${message.slice(0, 200)}`,
          subject: `Escalated: ${message.slice(0, 80)}`,
        },
      });
    } else {
      plan.push({
        name: "create_ticket",
        arguments: {
          question: message,
          summary: `Customer request: ${message.slice(0, 200)}`,
          subject: `Support: ${message.slice(0, 80)}`,
        },
      });
    }
  }

  if (intent.wantsNotify) {
    plan.push({
      name: "notify_team",
      arguments: {
        question: message,
        message: `Customer needs team attention: ${message.slice(0, 300)}`,
        severity: intent.wantsEscalate ? "high" : "info",
      },
    });
  }

  if (intent.wantsCrmNote) {
    plan.push({
      name: "log_crm_note",
      arguments: {
        question: message,
        note: `Agent note: ${message.slice(0, 300)}`,
      },
    });
  }

  return plan;
}

async function seedSearch(ctx: AgentContext): Promise<ToolTraceEntry> {
  return executeTool(
    { name: "search_docs", arguments: { query: ctx.message, top_k: 6 } },
    ctx
  );
}

async function composeFinalAnswer(
  ctx: AgentContext,
  toolTrace: ToolTraceEntry[]
): Promise<{ answer: string; mode: AgentResult["mode"]; refused: boolean }> {
  if (ctx.searchWeak || ctx.refused) {
    const gap = toolTrace.find((t) => t.name === "record_knowledge_gap" && t.ok);
    const gapHint = gap
      ? " I've logged this as a knowledge gap for the docs team."
      : "";
    return {
      answer:
        "I couldn’t find that in the Northstar help center." +
        gapHint +
        "\n\nI can help with billing, refunds, plans, password resets, and getting started — or email support@northstar-analytics.example.",
      mode: "refuse",
      refused: true,
    };
  }

  // Load full scored chunks for generateAnswer
  await ensureIndex();
  const store = getStore();
  const hits = await store.search(ctx.message, 6);
  const { answer, mode, refused } = await generateAnswer(ctx.message, hits);

  // Append action summary when tools ran
  const actions = toolTrace.filter((t) => t.name !== "search_docs" && t.ok);
  if (actions.length && !refused) {
    const lines = actions.map((t) => {
      const r = t.result as Record<string, unknown>;
      if (t.name === "create_ticket") return `• Created ticket ${r.ticketId}`;
      if (t.name === "escalate_ticket")
        return `• Escalated ticket ${r.ticketId} (priority ${r.priority})`;
      if (t.name === "notify_team") {
        return `• Notified the team`;
      }
      if (t.name === "log_crm_note") return `• Logged CRM note`;
      if (t.name === "record_knowledge_gap") return `• Recorded knowledge gap`;
      return `• ${t.name}`;
    });
    return {
      answer: `${answer}\n\n**Actions taken:**\n${lines.join("\n")}`,
      mode: mode === "refuse" ? "refuse" : "agent",
      refused,
    };
  }

  return {
    answer,
    mode: mode === "refuse" ? "refuse" : mode === "offline" ? "offline" : "agent",
    refused,
  };
}

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

async function ollamaChatWithTools(
  messages: ChatMsg[],
  useTools: boolean
): Promise<{
  content: string | null;
  tool_calls?: ChatMsg["tool_calls"];
}> {
  const base = getOllamaBaseUrl();
  const model = getOllamaModel();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.2,
      messages,
      stream: false,
    };
    if (useTools) {
      body.tools = TOOL_DEFINITIONS;
      body.tool_choice = "auto";
    }
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama tools chat failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: ChatMsg["tool_calls"];
        };
      }>;
    };
    const msg = data.choices?.[0]?.message;
    return {
      content: msg?.content?.trim() || null,
      tool_calls: msg?.tool_calls,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function openaiChatWithTools(messages: ChatMsg[]): Promise<{
  content: string | null;
  tool_calls?: ChatMsg["tool_calls"];
}> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    tools: TOOL_DEFINITIONS as OpenAI.Chat.ChatCompletionTool[],
    tool_choice: "auto",
  });
  const msg = completion.choices[0]?.message;
  return {
    content: msg?.content?.trim() || null,
    tool_calls: msg?.tool_calls as ChatMsg["tool_calls"],
  };
}

function extractJsonPlan(text: string): AgentToolCall[] | null {
  // Try fenced JSON or raw array/object with tools key
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : text.trim();
  try {
    const parsed = JSON.parse(candidate);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.tools)
        ? parsed.tools
        : Array.isArray(parsed?.actions)
          ? parsed.actions
          : null;
    if (!list) return null;
    const calls: AgentToolCall[] = [];
    for (const item of list) {
      const name = (item.name || item.tool) as string;
      if (!TOOL_NAMES.has(name)) continue;
      calls.push({
        name: name as AgentToolName,
        arguments: parseToolArgs(item.arguments ?? item.args ?? item.input ?? {}),
      });
    }
    return calls.length ? calls : null;
  } catch {
    // try to find first [...] array
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return extractJsonPlan(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runJsonPlanLoop(
  message: string,
  ctx: AgentContext,
  toolTrace: ToolTraceEntry[]
): Promise<boolean> {
  // Ask Ollama for a JSON tool plan (works on models without native tools)
  const planPrompt = `Given the customer message, return ONLY a JSON array of tool calls to execute (max ${MAX_STEPS}).
Each item: {"name":"<tool>","arguments":{...}}
Available tools: ${TOOL_DEFINITIONS.map((t) => t.function.name).join(", ")}

Always include search_docs first for factual questions.
If the topic is likely missing from docs (e.g. HIPAA), still search_docs then record_knowledge_gap.
If they ask to create a ticket and notify the team, include create_ticket and notify_team.

Customer message: ${JSON.stringify(message)}

JSON array:`;

  const base = getOllamaBaseUrl();
  const model = getOllamaModel();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AGENT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: "You output only valid JSON arrays of tool calls. No prose." },
          { role: "user", content: planPrompt },
        ],
        stream: false,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    const plan = extractJsonPlan(content);
    if (!plan) return false;

    // Ensure search_docs runs first if missing
    const ordered = [...plan];
    if (!ordered.some((c) => c.name === "search_docs")) {
      ordered.unshift({ name: "search_docs", arguments: { query: message } });
    }

    for (const call of ordered.slice(0, MAX_STEPS)) {
      const entry = await executeTool(call, ctx);
      toolTrace.push(entry);
    }

    // If weak after search and no gap recorded, add it
    if (ctx.searchWeak && !toolTrace.some((t) => t.name === "record_knowledge_gap")) {
      const entry = await executeTool(
        {
          name: "record_knowledge_gap",
          arguments: {
            topic: /\bhipaa\b/i.test(message) ? "HIPAA / compliance SLA" : "unknown_topic",
            question: message,
          },
        },
        ctx
      );
      toolTrace.push(entry);
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runNativeToolLoop(
  message: string,
  ctx: AgentContext,
  toolTrace: ToolTraceEntry[],
  backend: "ollama" | "openai"
): Promise<"ok" | "fallback"> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: message },
  ];

  let steps = 0;
  while (steps < MAX_STEPS) {
    steps++;
    let response: { content: string | null; tool_calls?: ChatMsg["tool_calls"] };
    try {
      response =
        backend === "ollama"
          ? await ollamaChatWithTools(messages, true)
          : await openaiChatWithTools(messages);
    } catch (err) {
      console.error("Native tool loop failed:", err);
      return "fallback";
    }

    const calls = response.tool_calls;
    if (calls && calls.length > 0) {
      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: calls,
      });
      for (const tc of calls) {
        const name = tc.function?.name;
        if (!TOOL_NAMES.has(name)) {
          toolTrace.push({
            name: name || "unknown",
            args: {},
            result: { error: "unknown tool" },
            ok: false,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name,
            content: JSON.stringify({ error: "unknown tool" }),
          });
          continue;
        }
        const call: AgentToolCall = {
          name: name as AgentToolName,
          arguments: parseToolArgs(tc.function.arguments),
        };
        const entry = await executeTool(call, ctx);
        toolTrace.push(entry);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(entry.result),
        });
      }
      continue;
    }

    // Final text response from model (may still be discarded if it dumps chunks)
    if (response.content) {
      ctx.lastAnswer = sanitizeCustomerAnswer(response.content);
    }
    break;
  }

  // Guarantee search happened
  if (!toolTrace.some((t) => t.name === "search_docs")) {
    toolTrace.unshift(await seedSearch(ctx));
  }
  if (ctx.searchWeak && !toolTrace.some((t) => t.name === "record_knowledge_gap")) {
    toolTrace.push(
      await executeTool(
        {
          name: "record_knowledge_gap",
          arguments: {
            topic: /\bhipaa\b/i.test(message) ? "HIPAA / compliance SLA" : "unknown_topic",
            question: message,
          },
        },
        ctx
      )
    );
  }

  return "ok";
}

async function runHeuristicAgent(
  message: string,
  ctx: AgentContext,
  toolTrace: ToolTraceEntry[]
): Promise<void> {
  // 1) Always search first
  const searchEntry = await seedSearch(ctx);
  toolTrace.push(searchEntry);

  // 2) Plan remaining tools with knowledge of weak/strong
  const intent = detectIntent(message);
  const rest: AgentToolCall[] = [];

  if (ctx.searchWeak) {
    rest.push({
      name: "record_knowledge_gap",
      arguments: {
        topic: /\bhipaa\b/i.test(message)
          ? "HIPAA / compliance SLA"
          : /\bsla\b/i.test(message)
            ? "SLA"
            : "unknown_topic",
        question: message,
      },
    });
  } else {
    if (intent.wantsEscalate) {
      rest.push({
        name: "escalate_ticket",
        arguments: {
          question: message,
          summary: `Escalated: ${message.slice(0, 200)}`,
          subject: `Escalated: ${message.slice(0, 80)}`,
        },
      });
    } else if (intent.wantsTicket) {
      rest.push({
        name: "create_ticket",
        arguments: {
          question: message,
          summary: `Customer request: ${message.slice(0, 200)}`,
          subject: `Support: ${message.slice(0, 80)}`,
        },
      });
    }
    if (intent.wantsNotify) {
      rest.push({
        name: "notify_team",
        arguments: {
          question: message,
          message: `Customer needs team attention: ${message.slice(0, 300)}`,
          severity: intent.wantsEscalate ? "high" : "info",
        },
      });
    }
    if (intent.wantsCrmNote) {
      rest.push({
        name: "log_crm_note",
        arguments: { question: message, note: message.slice(0, 300) },
      });
    }
  }

  for (const call of rest.slice(0, MAX_STEPS - 1)) {
    toolTrace.push(await executeTool(call, ctx));
  }
}

/**
 * Run the Premium support agent on a single user message.
 */

/** If the model forgot action tools the user clearly asked for, fulfill them. */
async function ensureIntentActions(
  message: string,
  ctx: AgentContext,
  toolTrace: ToolTraceEntry[]
): Promise<void> {
  if (ctx.searchWeak) return;
  const intent = detectIntent(message);
  const called = new Set(toolTrace.map((t) => t.name));

  if (intent.wantsEscalate && !called.has("escalate_ticket")) {
    toolTrace.push(
      await executeTool(
        {
          name: "escalate_ticket",
          arguments: {
            question: message,
            summary: `Escalated: ${message.slice(0, 200)}`,
            subject: `Escalated: ${message.slice(0, 80)}`,
          },
        },
        ctx
      )
    );
  } else if (intent.wantsTicket && !called.has("create_ticket") && !called.has("escalate_ticket")) {
    toolTrace.push(
      await executeTool(
        {
          name: "create_ticket",
          arguments: {
            question: message,
            summary: ctx.lastAnswer.slice(0, 400) || `Customer request: ${message.slice(0, 200)}`,
            subject: `Support: ${message.slice(0, 80)}`,
          },
        },
        ctx
      )
    );
  }

  if (intent.wantsNotify && !called.has("notify_team")) {
    toolTrace.push(
      await executeTool(
        {
          name: "notify_team",
          arguments: {
            question: message,
            message: `Customer needs team attention: ${message.slice(0, 300)}`,
            severity: intent.wantsEscalate ? "high" : "info",
          },
        },
        ctx
      )
    );
  }

  if (intent.wantsCrmNote && !called.has("log_crm_note")) {
    toolTrace.push(
      await executeTool(
        {
          name: "log_crm_note",
          arguments: { question: message, note: message.slice(0, 300) },
        },
        ctx
      )
    );
  }
}

export async function runSupportAgent(message: string): Promise<AgentResult> {
  const ctx = emptyCtx(message);
  const toolTrace: ToolTraceEntry[] = [];
  let planner: AgentResult["planner"] = "heuristic";

  const ollamaUp = await isOllamaReachable();

  if (ollamaUp) {
    // Try native tools first; many Ollama models return gracefully or error
    const native = await runNativeToolLoop(message, ctx, toolTrace, "ollama");
    if (native === "ok" && toolTrace.length > 0) {
      planner = "ollama-tools";
    } else {
      // Clear partial failed native attempt if empty, try JSON plan
      if (toolTrace.length === 0) {
        const ok = await runJsonPlanLoop(message, ctx, toolTrace);
        if (ok) planner = "ollama-json";
        else {
          await runHeuristicAgent(message, ctx, toolTrace);
          planner = "heuristic";
        }
      } else {
        // Partial native — if no search, finish with heuristic actions
        if (!toolTrace.some((t) => t.name === "search_docs")) {
          await runHeuristicAgent(message, ctx, toolTrace);
        }
        planner = "ollama-tools";
      }
    }
  } else if (hasOpenAI()) {
    const native = await runNativeToolLoop(message, ctx, toolTrace, "openai");
    if (native === "ok") {
      planner = "openai-tools";
    } else {
      toolTrace.length = 0;
      await runHeuristicAgent(message, ctx, toolTrace);
      planner = "heuristic";
    }
  } else {
    await runHeuristicAgent(message, ctx, toolTrace);
    planner = "heuristic";
  }

  // Ensure we have retrieval/citations even if search was skipped somehow
  if (ctx.retrieval.length === 0) {
    await ensureIndex();
    const store = getStore();
    const hits = await store.search(message, 6);
    const weak = isWeakRetrieval(hits);
    ctx.retrieval = hitsToRetrieval(hits);
    ctx.citations = hitsToCitations(hits, weak);
    ctx.searchWeak = weak;
    ctx.refused = weak;
  }

  await ensureIntentActions(message, ctx, toolTrace);

  const composed = await composeFinalAnswer(ctx, toolTrace);
  // Always use generateAnswer-backed composition for the customer reply.
  // Native-tool model text often echoes search_docs chunk lists — never show that.
  void ctx.lastAnswer;
  void planner;
  const answer = sanitizeCustomerAnswer(composed.answer);

  return {
    answer,
    citations: ctx.citations,
    retrieval: ctx.retrieval,
    mode: composed.refused ? "refuse" : composed.mode,
    refused: composed.refused,
    toolTrace,
    planner,
    steps: toolTrace.length,
  };
}
