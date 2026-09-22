import { NextResponse } from "next/server";
import { listTickets } from "@/lib/actions-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tickets = listTickets();
    return NextResponse.json({ ok: true, tickets });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to list tickets" }, { status: 500 });
  }
}
