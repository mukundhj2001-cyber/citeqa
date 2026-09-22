/** Client-safe types for Premium agent actions (no Node imports). */

export type TicketCitation = {
  docTitle: string;
  section: string;
  rank: number;
  score?: number;
};

export type Ticket = {
  id: string;
  subject: string;
  body: string;
  question: string;
  answerSummary: string;
  citations: TicketCitation[];
  status: "open" | "pending" | "closed";
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
