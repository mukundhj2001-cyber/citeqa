/**
 * Premium agent action persistence — local JSON tickets + CSV action log.
 * Privacy-first: everything stays on disk under data/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  Ticket,
  TicketCitation,
  TicketPriority,
  TicketStatus,
  ActionLogEntry,
  KnowledgeGap,
} from "@/lib/action-types";

export type { Ticket, TicketCitation, ActionLogEntry, KnowledgeGap };

const DATA_DIR = resolve(process.cwd(), "data");
const TICKETS_PATH = resolve(DATA_DIR, "tickets.json");
const LOG_PATH = resolve(DATA_DIR, "action-log.csv");
const LAST_EVAL_PATH = resolve(DATA_DIR, "last-eval.json");
const GAPS_PATH = resolve(DATA_DIR, "knowledge-gaps.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function ensureTicketsFile() {
  ensureDataDir();
  if (!existsSync(TICKETS_PATH)) {
    writeFileSync(TICKETS_PATH, "[]\n", "utf8");
  }
}

function ensureLogFile() {
  ensureDataDir();
  if (!existsSync(LOG_PATH)) {
    writeFileSync(LOG_PATH, "timestamp,question,action,result,detail\n", "utf8");
  }
}

function ensureGapsFile() {
  ensureDataDir();
  if (!existsSync(GAPS_PATH)) {
    writeFileSync(GAPS_PATH, "[]\n", "utf8");
  }
}

function csvEscape(s: string): string {
  const t = (s ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function normalizeTicket(raw: Partial<Ticket> & { id: string }): Ticket {
  return {
    id: raw.id,
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    question: raw.question ?? "",
    answerSummary: raw.answerSummary ?? "",
    citations: Array.isArray(raw.citations) ? raw.citations : [],
    status: (raw.status as TicketStatus) || "open",
    priority: (raw.priority as TicketPriority) || "normal",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export function listTickets(): Ticket[] {
  ensureTicketsFile();
  try {
    const raw = JSON.parse(readFileSync(TICKETS_PATH, "utf8")) as Partial<Ticket>[];
    return Array.isArray(raw) ? raw.map((t) => normalizeTicket(t as Ticket)) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[]) {
  ensureTicketsFile();
  writeFileSync(TICKETS_PATH, JSON.stringify(tickets, null, 2) + "\n", "utf8");
}

export function getTicket(id: string): Ticket | null {
  return listTickets().find((t) => t.id === id) ?? null;
}

export function createTicket(input: {
  subject: string;
  body: string;
  question: string;
  answerSummary: string;
  citations: TicketCitation[];
  status?: TicketStatus;
  priority?: TicketPriority;
}): Ticket {
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: `tkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    subject: input.subject.slice(0, 200),
    body: input.body.slice(0, 4000),
    question: input.question.slice(0, 2000),
    answerSummary: input.answerSummary.slice(0, 2000),
    citations: input.citations.slice(0, 8),
    status: input.status ?? "open",
    priority: input.priority ?? "normal",
    createdAt: now,
    updatedAt: now,
  };
  const tickets = listTickets();
  tickets.unshift(ticket);
  saveTickets(tickets);
  return ticket;
}

export function updateTicket(
  id: string,
  patch: Partial<Pick<Ticket, "subject" | "body" | "answerSummary" | "status" | "priority" | "citations">>
): Ticket | null {
  const tickets = listTickets();
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  tickets[idx] = {
    ...tickets[idx],
    ...patch,
    updatedAt: now,
  };
  saveTickets(tickets);
  return tickets[idx];
}

/** Create a new escalated ticket, or upgrade an existing one by id. */
export function escalateTicket(input: {
  ticketId?: string;
  subject: string;
  body: string;
  question: string;
  answerSummary: string;
  citations: TicketCitation[];
}): Ticket {
  if (input.ticketId) {
    const updated = updateTicket(input.ticketId, {
      status: "escalated",
      priority: "high",
      answerSummary: input.answerSummary.slice(0, 2000),
      citations: input.citations.slice(0, 8),
    });
    if (updated) return updated;
  }
  return createTicket({
    ...input,
    status: "escalated",
    priority: "high",
  });
}

export function appendActionLog(entry: Omit<ActionLogEntry, "timestamp"> & { timestamp?: string }) {
  ensureLogFile();
  const timestamp = entry.timestamp ?? new Date().toISOString();
  const line = [
    csvEscape(timestamp),
    csvEscape(entry.question),
    csvEscape(entry.action),
    csvEscape(entry.result),
    csvEscape(entry.detail),
  ].join(",");
  appendFileSync(LOG_PATH, line + "\n", "utf8");
  return { ...entry, timestamp };
}

export function readActionLog(limit = 200): ActionLogEntry[] {
  ensureLogFile();
  const text = readFileSync(LOG_PATH, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const rows: ActionLogEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    rows.push({
      timestamp: cols[0] ?? "",
      question: cols[1] ?? "",
      action: cols[2] ?? "",
      result: cols[3] ?? "",
      detail: cols[4] ?? "",
    });
  }
  return rows.reverse().slice(0, limit);
}

/** Minimal CSV line parser supporting quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function listKnowledgeGaps(): KnowledgeGap[] {
  ensureGapsFile();
  try {
    const raw = JSON.parse(readFileSync(GAPS_PATH, "utf8")) as KnowledgeGap[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function recordKnowledgeGap(input: { topic: string; question: string }): KnowledgeGap {
  ensureGapsFile();
  const gap: KnowledgeGap = {
    id: `gap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    topic: input.topic.slice(0, 200),
    question: input.question.slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  const gaps = listKnowledgeGaps();
  gaps.unshift(gap);
  writeFileSync(GAPS_PATH, JSON.stringify(gaps.slice(0, 500), null, 2) + "\n", "utf8");
  return gap;
}

export function saveLastEval(summary: unknown) {
  ensureDataDir();
  writeFileSync(LAST_EVAL_PATH, JSON.stringify(summary, null, 2) + "\n", "utf8");
}

export function loadLastEval(): unknown | null {
  if (!existsSync(LAST_EVAL_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LAST_EVAL_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function dataPaths() {
  return {
    tickets: TICKETS_PATH,
    log: LOG_PATH,
    lastEval: LAST_EVAL_PATH,
    gaps: GAPS_PATH,
    dir: DATA_DIR,
  };
}
