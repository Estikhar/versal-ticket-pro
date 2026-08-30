import { NextResponse } from "next/server";
import { reserveMultipleSeats } from "@/lib/store";

const PHONE = /^[6-9]\d{9}$/;
const NAME_MIN = 3;

export async function POST(req: Request) {
  const body = await req.json();
  const seats = [...new Set<string>(body.seats ?? [])];
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const utr = String(body.utr ?? "").trim();

  const errors: string[] = [];
  if (!seats.length) errors.push("Pick at least one seat.");
  if (name.length < NAME_MIN) errors.push(`Full name must be at least ${NAME_MIN} characters.`);
  if (!PHONE.test(phone)) errors.push("Phone must be exactly 10 digits starting with 6-9.");
  
  // UTR ki strict 12-digit shart hata di gayi hai, ab bas blank nahi hona chahiye
  if (!utr) errors.push("Transaction ID is missing."); 

  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 });

  try {
    const result = await reserveMultipleSeats(seats, name, phone, utr);
    return NextResponse.json(
      { ok: result.ok, message: result.message, errors: result.ok ? [] : [result.message] },
      { status: result.ok ? 200 : 409 },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { ok: false, errors: [`${detail} — no seats were taken and nothing was charged.`] },
      { status: 503 },
    );
  }
}
