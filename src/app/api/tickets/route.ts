import { NextResponse } from "next/server";
import { allSeats, findByPhone, getPrices } from "@/lib/store";
import { seatTier } from "@/lib/venue";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "Enter a valid 10-digit number starting 6-9." },
                             { status: 400 });
  }
  const [rows, prices] = await Promise.all([allSeats(), getPrices()]);
  const mine = findByPhone(rows, phone).map((r) => ({
    ...r, tier: seatTier(r.seat_id), amount: prices[seatTier(r.seat_id)],
  }));
  return NextResponse.json({ ok: true, rows: mine });
}
