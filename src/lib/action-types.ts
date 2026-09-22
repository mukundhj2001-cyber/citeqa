/** Client-safe types for Premium agent actions (no Node imports). */

export type TicketCitation = {
  docTitle: string;
  section: string;
  rank: number;
  score?: number;
};

export type TicketStatus = "open" | "pending" | "closed" | "escalated";
export type TicketPriority = "normal" | "high";

export type Ticket = {
  id: string;
  subject: string;
  body: string;
  question: string;
  answerSummary: string;
  citations: TicketCitation[];
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
};

export type ActionLogEntry = {
  timestamp: string;
  question: string;
  action: string;
  result: string;
  detail: string;
};

/** One step in the autonomous support agent's tool loop (UI transparency). */
export type ToolTraceEntry = {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  ok: boolean;
  ms?: number;
};

export type KnowledgeGap = {
  id: string;
  topic: string;
  question: string;
  createdAt: string;
};
