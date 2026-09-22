/**
 * Shared eval harness — used by `npm run eval` and POST /api/eval.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { answerQuestion } from "@/lib/rag";
import { ensureIndex } from "@/lib/knowledge";
import type { ChatResponse } from "@/lib/types";
import { saveLastEval } from "@/lib/actions-store";

export type EvalCase = {
  id: string;
  question: string;
  expectRefuse: boolean;
  mustIncludeAny?: string[];
  mustCiteDoc?: string;
  mustCiteSection?: string;
};

export type CaseResult = {
  id: string;
  question: string;
  pass: boolean;
  reasons: string[];
  mode: string;
  refused: boolean;
  topLabel: string;
};

export type EvalSummary = {
  ok: boolean;
  passed: number;
  failed: number;
  total: number;
  index: { chunkCount: number; docCount: number; fromDisk?: boolean };
  results: CaseResult[];
  ranAt: string;
};

function loadCases(): EvalCase[] {
  const path = resolve(process.cwd(), "evals/cases.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as EvalCase[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`No eval cases in ${path}`);
  }
  return raw;
}

function includesCI(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function topRetrievalLabel(res: ChatResponse): string {
  const t = res.retrieval[0];
  if (!t) return "(none)";
  return `${t.section} (${t.score.toFixed(3)}) [${t.docTitle}]`;
}

function retrievalMatchesHints(res: ChatResponse, c: EvalCase): boolean {
  if (!c.mustCiteDoc && !c.mustCiteSection) return false;
  const pool = [
    ...res.retrieval.slice(0, 4),
    ...res.citations.slice(0, 4),
  ];
  if (!pool.length) return false;

  return pool.some((h) => {
    const docOk = c.mustCiteDoc
      ? includesCI(h.docTitle, c.mustCiteDoc)
      : true;
    const secOk = c.mustCiteSection
      ? includesCI(h.section, c.mustCiteSection) ||
        includesCI(h.snippet ?? "", c.mustCiteSection)
      : true;
    return docOk && secOk;
  });
}

function keywordMatches(res: ChatResponse, c: EvalCase): boolean {
  if (!c.mustIncludeAny?.length) return false;
  const citeBits = res.citations
    .slice(0, 3)
    .map((x) => `${x.docTitle} ${x.section} ${x.snippet}`)
    .join("\n");
  const retrBits = res.retrieval
    .slice(0, 3)
    .map((x) => `${x.docTitle} ${x.section} ${x.snippet}`)
    .join("\n");
  const hay = `${res.answer}\n${citeBits}\n${retrBits}`;
  return c.mustIncludeAny.some((k) => includesCI(hay, k));
}

export function scoreCase(c: EvalCase, res: ChatResponse): CaseResult {
  const reasons: string[] = [];
  let pass = true;
  const topLabel = topRetrievalLabel(res);

  if (c.expectRefuse) {
    if (!res.refused) {
      pass = false;
      reasons.push(`expected refuse=true but refused=${res.refused} top=${topLabel}`);
    }
  } else {
    const hasHints = Boolean(c.mustCiteDoc || c.mustCiteSection);
    const hasKeywords = Boolean(c.mustIncludeAny?.length);
    const retrOk = retrievalMatchesHints(res, c);
    const kwOk = keywordMatches(res, c);

    if (hasHints || hasKeywords) {
      if (!(retrOk || kwOk)) {
        pass = false;
        const parts: string[] = [];
        if (hasHints) {
          parts.push(
            `retrieval miss (want doc~"${c.mustCiteDoc ?? "*"}" section~"${c.mustCiteSection ?? "*"}"; top=${topLabel})`
          );
        }
        if (hasKeywords) {
          parts.push(
            `keywords miss (want any of: ${c.mustIncludeAny!.join(" | ")})`
          );
        }
        if (res.refused) parts.push("also refused=true");
        reasons.push(parts.join("; "));
      } else if (res.refused) {
        reasons.push(
          `note: refused=true but retrieval/keywords still matched · ${topLabel}`
        );
      }
    } else if (res.refused) {
      pass = false;
      reasons.push(`expected answer but refused=true (top=${topLabel})`);
    }
  }

  if (pass && reasons.length === 0) {
    if (c.expectRefuse) reasons.push("refused as expected");
    else if (retrievalMatchesHints(res, c)) reasons.push(`retrieval ok · ${topLabel}`);
    else if (keywordMatches(res, c)) reasons.push("keyword match in answer/citations");
    else reasons.push(`answered · ${topLabel}`);
  }

  return {
    id: c.id,
    question: c.question,
    pass,
    reasons,
    mode: res.mode,
    refused: res.refused,
    topLabel,
  };
}

/** Run full suite; persists last-eval.json for admin UI. */
export async function runEvalSuite(opts?: {
  onProgress?: (id: string) => void;
  skipWarmup?: boolean;
}): Promise<EvalSummary> {
  const stats = await ensureIndex();
  const cases = loadCases();

  if (!opts?.skipWarmup) {
    await answerQuestion("warmup");
  }

  const results: CaseResult[] = [];
  for (const c of cases) {
    opts?.onProgress?.(c.id);
    const res = await answerQuestion(c.question);
    results.push(scoreCase(c, res));
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const summary: EvalSummary = {
    ok: failed === 0,
    passed,
    failed,
    total: results.length,
    index: {
      chunkCount: stats.chunkCount,
      docCount: stats.docCount,
      fromDisk: stats.fromDisk,
    },
    results,
    ranAt: new Date().toISOString(),
  };
  saveLastEval(summary);
  return summary;
}
