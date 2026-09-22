import { NextResponse } from "next/server";
import {
  appendActionLog,
  createTicket,
  type TicketCitation,
} from "@/lib/actions-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const subject =
      typeof body?.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : question.slice(0, 120) || "Support ticket from CiteQA";
    const rawCitations = Array.isArray(body?.citations) ? body.citations : [];
    const citations: TicketCitation[] = rawCitations
      .slice(0, 8)
      .map((c: Record<string, unknown>) => ({
        docTitle: String(c.docTitle ?? ""),
        section: String(c.section ?? ""),
        rank: Number(c.rank ?? 0),
        score: typeof c.score === "number" ? c.score : undefined,
      }));

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const citeLines = citations
      .map((c) => `[${c.rank}] ${c.docTitle} — ${c.section}`)
      .join("\n");
    const ticketBody = [
      `Customer question:\n${question}`,
      "",
      `Grounded answer summary:\n${answer.slice(0, 1500) || "(none)"}`,
      "",
      citeLines ? `Source citations:\n${citeLines}` : "Source citations: (none)",
    ].join("\n");

    const ticket = createTicket({
      subject,
      body: ticketBody,
      question,
      answerSummary: answer.slice(0, 1500),
      citations,
    });

    appendActionLog({
      question,
      action: "create_ticket",
      result: "ok",
      detail: `ticket=${ticket.id} status=${ticket.status}`,
    });

    return NextResponse.json({
      ok: true,
      ticket,
      adminHint: "/admin#tickets",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
