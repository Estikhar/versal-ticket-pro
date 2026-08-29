import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueToken, passwordOk, COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!passwordOk(String(password ?? ""))) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }
  (await cookies()).set(COOKIE, issueToken(), {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return NextResponse.json({ ok: true });
}
