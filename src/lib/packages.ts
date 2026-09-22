/** Freelance package tiers shown on landing + lightly enforced in demo UI. */

export type PackageId = "basic" | "standard" | "premium";

export type PackageDef = {
  id: PackageId;
  name: string;
  tagline: string;
  priceLabel: string;
  highlight?: boolean;
  features: string[];
  /** Features that unlock agent UI / admin extras */
  includesAgent: boolean;
  includesUpload: boolean;
  includesEval: boolean;
  includesAdmin: boolean;
};

export const PACKAGES: PackageDef[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Private RAG Q&A on your docs",
    priceLabel: "Starter",
    features: [
      "RAG Q&A grounded in your knowledge base",
      "Clickable citations (doc · section · snippet)",
      "Refuse-when-unknown (no invented policy)",
      "Local MiniLM embeddings — docs never leave for embedding",
    ],
    includesAgent: false,
    includesUpload: false,
    includesEval: false,
    includesAdmin: false,
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "Upload, re-index, eval suite + Ollama",
    priceLabel: "Most popular",
    features: [
      "Everything in Basic",
      "Upload / re-index (.md · .txt · .pdf)",
      "Offline eval harness (pass/fail report)",
      "Private Ollama-first answer generation",
    ],
    includesAgent: false,
    includesUpload: true,
    includesEval: true,
    includesAdmin: false,
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Autonomous tool-calling agent + admin",
    priceLabel: "Full product",
    highlight: true,
    features: [
      "Everything in Standard",
      "Autonomous tool-calling support agent (multi-step)",
      "Tools: search · ticket · escalate · CRM note · notify · knowledge gaps",
      "Transparent tool trace + optional manual actions",
      "Admin dashboard: docs, eval, tickets, action log",
    ],
    includesAgent: true,
    includesUpload: true,
    includesEval: true,
    includesAdmin: true,
  },
];

export function getPackage(id: PackageId): PackageDef {
  return PACKAGES.find((p) => p.id === id) ?? PACKAGES[2];
}
