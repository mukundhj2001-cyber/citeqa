export type DocMeta = {
  id: string;
  title: string;
  filename: string;
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

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  retrieval?: RetrievalHit[];
  mode?: "llm" | "offline" | "refuse";
  refused?: boolean;
};

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  retrieval: RetrievalHit[];
  mode: "llm" | "offline" | "refuse";
  refused: boolean;
};
