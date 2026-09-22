import { NextResponse } from "next/server";
import { appendActionLog } from "@/lib/actions-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const citations = Array.isArray(body?.citations) ? body.citations : [];

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const payload = {
      source: "citeqa",
      event: "agent_webhook",
      question,
      answer: answer.slice(0, 2000),
      citations: citations.slice(0, 8),
      at: new Date().toISOString(),
    };

    const webhookUrl = process.env.WEBHOOK_URL?.trim();
    let result = "simulated";
    let detail = "WEBHOOK_URL not set — logged locally only";
    let statusCode: number | null = null;

    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        statusCode = res.status;
        result = res.ok ? "ok" : "http_error";
        detail = `POST ${webhookUrl} → ${res.status}`;
      } catch (e) {
        result = "network_error";
        detail = e instanceof Error ? e.message : "webhook failed";
      }
    }

    appendActionLog({
      question,
      action: "webhook",
      result,
      detail,
    });

    return NextResponse.json({
      ok: result === "ok" || result === "simulated",
      result,
      detail,
      statusCode,
      simulated: !webhookUrl,
      adminHint: "/admin#actions",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to send webhook" }, { status: 500 });
  }
}
