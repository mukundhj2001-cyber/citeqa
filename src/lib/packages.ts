/** Plan tiers shown on landing + lightly enforced in demo UI. */

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
    tagline: "Help chat grounded in your docs",
    priceLabel: "Starter",
    features: [
      "Answers from your help center",
      "Links to the articles used",
      "Honest “I don’t know” when it’s not in your docs",
      "Your content stays private",
    ],
    includesAgent: false,
    includesUpload: false,
    includesEval: false,
    includesAdmin: false,
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "Upload docs and keep answers current",
    priceLabel: "Most popular",
    features: [
      "Everything in Basic",
      "Upload help articles (.md · .txt · .pdf)",
      "Quality checks before you ship",
      "Private on-prem answer generation",
    ],
    includesAgent: false,
    includesUpload: true,
    includesEval: true,
    includesAdmin: false,
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Support assistant that can take action",
    priceLabel: "Full product",
    highlight: true,
    features: [
      "Everything in Standard",
      "Creates tickets and escalates to your team",
      "Notifies ops and logs follow-ups",
      "Clear “actions taken” trail for each chat",
      "Operator dashboard for docs, tickets, and activity",
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
