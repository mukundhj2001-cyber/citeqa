/**
 * CiteQA eval harness — fixed questions, expected refuse/cite behavior, pass/fail report.
 * Runs the same pipeline as chat (`answerQuestion`). Works offline (no OpenAI required).
 *
 * Usage: npm run eval
 * Exit 1 if any case fails (CI-friendly).
 */
import { runEvalSuite } from "../src/lib/eval-harness";

function pad(s: string, n: number): string {
  const t = s.length > n ? s.slice(0, n - 1) + "…" : s;
  return t.padEnd(n);
}

async function main() {
  console.log("CiteQA eval harness\n");

  const summary = await runEvalSuite({
    onProgress: (id) => process.stdout.write(`  running ${id}…`),
  });

  // Reprint case details (onProgress only marks start)
  process.stdout.write("\r");
  for (const scored of summary.results) {
    const mark = scored.pass ? "PASS" : "FAIL";
    console.log(`[${mark}] ${scored.id}`);
    console.log(`       Q: "${scored.question}"`);
    console.log(
      `       mode=${scored.mode} refused=${scored.refused} top=${scored.topLabel}`
    );
    for (const r of scored.reasons) {
      console.log(`       → ${r}`);
    }
  }

  console.log(
    `\nIndex: ${summary.index.chunkCount} chunks · docs=${summary.index.docCount} · fromDisk=${summary.index.fromDisk}`
  );
  console.log("\n── Summary ──────────────────────────────────────────────");
  console.log(`${pad("ID", 32)} ${pad("Result", 6)} ${pad("Mode", 8)} Top`);
  for (const r of summary.results) {
    console.log(
      `${pad(r.id, 32)} ${pad(r.pass ? "PASS" : "FAIL", 6)} ${pad(r.mode, 8)} ${r.topLabel}`
    );
  }
  console.log("─────────────────────────────────────────────────────────");
  console.log(
    `${summary.passed}/${summary.total} passed · ${summary.failed} failed`
  );

  if (!summary.ok) {
    console.error("\nEval suite FAILED");
    process.exit(1);
  }
  console.log("\nEval suite PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
