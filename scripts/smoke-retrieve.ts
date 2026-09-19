/**
 * Quick retrieval smoke test (no HTTP server required).
 */
import { ensureIndex } from "../src/lib/knowledge";
import { getStore } from "../src/lib/vectorstore";
import { isWeakRetrieval } from "../src/lib/generate";

const cases: { q: string; expectRefuse?: boolean; expectSectionIncludes?: string[] }[] = [
  { q: "How do refunds work?", expectSectionIncludes: ["Refund"] },
  { q: "Can I get my money back?", expectSectionIncludes: ["Refund"] },
  { q: "What's on Pro?", expectSectionIncludes: ["Pro"] },
  { q: "How do I reset my password?", expectSectionIncludes: ["Password"] },
  { q: "What's your enterprise HIPAA SLA?", expectRefuse: true },
];

async function main() {
  const stats = await ensureIndex();
  console.log(`Index ready: ${stats.chunkCount} chunks, fromDisk=${stats.fromDisk}`);
  const store = getStore();
  let failed = 0;

  for (const c of cases) {
    const hits = await store.search(c.q, 5);
    const weak = isWeakRetrieval(hits);
    const top = hits[0];
    const topLabel = top
      ? `${top.section} (${top.score.toFixed(3)}) [${top.docTitle}]`
      : "(none)";
    let ok = true;
    let reason = "";

    if (c.expectRefuse) {
      if (!weak) {
        ok = false;
        reason = `expected refuse but top=${topLabel}`;
      }
    } else {
      if (weak || !top) {
        ok = false;
        reason = `expected hits but weak/empty (top=${topLabel})`;
      } else if (c.expectSectionIncludes?.length) {
        const hay = `${top.section} ${top.text} ${top.docTitle}`;
        const matched = c.expectSectionIncludes.some((s) =>
          hay.toLowerCase().includes(s.toLowerCase())
        );
        if (!matched) {
          ok = false;
          reason = `top section/text missing ${c.expectSectionIncludes.join("|")}: ${topLabel}`;
        }
      }
    }

    const mark = ok ? "PASS" : "FAIL";
    if (!ok) failed++;
    console.log(`[${mark}] "${c.q}"`);
    console.log(`       top: ${topLabel}  weak=${weak}`);
    if (hits.length) {
      console.log(
        `       top3: ${hits
          .slice(0, 3)
          .map((h) => `${h.rank}.${h.section}:${h.score.toFixed(3)}`)
          .join(" | ")}`
      );
    }
    if (reason) console.log(`       ${reason}`);
  }

  if (failed) {
    console.error(`\n${failed} case(s) failed`);
    process.exit(1);
  }
  console.log("\nAll smoke cases passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
