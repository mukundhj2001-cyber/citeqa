import { NextResponse } from "next/server";
import { appendActionLog, readActionLog } from "@/lib/actions-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const entries = readActionLog(200);
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to read action log" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const entry = appendActionLog({
      question,
      action: "log_to_sheet",
      result: "ok",
      detail: note || `answer_len=${answer.length}`,
    });

    return NextResponse.json({
      ok: true,
      entry,
      adminHint: "/admin#actions",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to append log" }, { status: 500 });
  }
}
