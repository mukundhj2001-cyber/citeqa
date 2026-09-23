import type { ToolTraceEntry } from "@/lib/action-types";

export type DocMeta = {
  id: string;
  title: string;
  filename: string;
  source?: "sample" | "upload";
};

export type Chunk = {
  id: string;
  docId: string;
  docTitle: string;
  section: string;
  text: string;
  /** Lowercased tokens for lexical retrieval */
  tokens: string[];
};

export type ScoredChunk = Chunk & {
  score: number;
  rank: number;
};

export type Citation = {
  chunkId: string;
  docTitle: string;
  section: string;
  snippet: string;
  score: number;
  rank: number;
};

export type RetrievalHit = {
  id: string;
  docTitle: string;
  section: string;
  snippet: string;
  score: number;
  rank: number;
};

/** Answer generation backend used for this turn. */
export type ChatMode = "ollama" | "openai" | "offline" | "refuse" | "agent";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  citations?: Citation[];
  retrieval?: RetrievalHit[];
  mode?: ChatMode;
  refused?: boolean;
  toolTrace?: ToolTraceEntry[];
  planner?: string;
};

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  retrieval: RetrievalHit[];
  mode: ChatMode;
  refused: boolean;
};

export type AgentApiResponse = ChatResponse & {
  toolTrace: ToolTraceEntry[];
  planner: string;
  steps: number;
};
