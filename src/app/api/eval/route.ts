import { NextResponse } from "next/server";
import { runEvalSuite } from "@/lib/eval-harness";
import { loadLastEval } from "@/lib/actions-store";
import { appendActionLog } from "@/lib/actions-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const last = loadLastEval();
    return NextResponse.json({ ok: true, last });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load last eval" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const summary = await runEvalSuite();
    appendActionLog({
      question: "(eval suite)",
      action: "run_eval",
      result: summary.ok ? "pass" : "fail",
      detail: `${summary.passed}/${summary.total} passed`,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Eval failed" },
      { status: 500 }
    );
  }
}
