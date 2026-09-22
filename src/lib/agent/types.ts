import type { Citation, ChatMode, RetrievalHit } from "@/lib/types";
import type { ToolTraceEntry } from "@/lib/action-types";

export type { ToolTraceEntry };

export type AgentToolName =
  | "search_docs"
  | "create_ticket"
  | "escalate_ticket"
  | "log_crm_note"
  | "notify_team"
  | "record_knowledge_gap";

export type AgentToolCall = {
  name: AgentToolName;
  arguments: Record<string, unknown>;
};

export type AgentResult = {
  answer: string;
  citations: Citation[];
  retrieval: RetrievalHit[];
  mode: ChatMode | "agent";
  refused: boolean;
  toolTrace: ToolTraceEntry[];
  /** How the agent planned steps: native tools, JSON plan, or heuristic offline. */
  planner: "ollama-tools" | "ollama-json" | "openai-tools" | "heuristic";
  steps: number;
};

export type AgentContext = {
  message: string;
  citations: Citation[];
  retrieval: RetrievalHit[];
  lastAnswer: string;
  refused: boolean;
  searchWeak: boolean;
};
