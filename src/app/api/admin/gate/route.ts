import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_DEMO_PASSWORD?.trim();
  if (!expected) {
    // No password configured — open access when unset
    return NextResponse.json({ ok: true, open: true });
  }
  try {
    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";
    if (password === expected) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
