import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, COOKIE } from "@/lib/session";
import { allSeats, setStatus, resetHouse, checkIn, getPrices, setPrices } from "@/lib/store";
import { BOOKED, AVAILABLE } from "@/lib/types";
import { TIER_ORDER, type TierId } from "@/lib/venue";

export const dynamic = "force-dynamic";
const authed = async () => verifyToken((await cookies()).get(COOKIE)?.value);

export async function GET() {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 401 });
  const [rows, prices] = await Promise.all([allSeats(), getPrices()]);
  return NextResponse.json({ ok: true, rows, prices });
}

export async function POST(req: Request) {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 401 });
  const { action, seat, prices } = await req.json();

  if (action === "approve") return NextResponse.json(await setStatus(String(seat), BOOKED));
  if (action === "reject")  return NextResponse.json(await setStatus(String(seat), AVAILABLE));
  if (action === "checkin") return NextResponse.json(await checkIn(String(seat)));
  if (action === "reset") { await resetHouse(); return NextResponse.json({ ok: true }); }
  if (action === "prices") {
    const next = {} as Record<TierId, number>;
    for (const t of TIER_ORDER) {
      const n = Number(prices?.[t]);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return NextResponse.json({ ok: false, message: `Bad price for ${t}.` }, { status: 400 });
      }
      next[t] = Math.round(n);
    }
    await setPrices(next);
    return NextResponse.json({ ok: true, prices: await getPrices() });
  }
  return NextResponse.json({ ok: false, message: "unknown action" }, { status: 400 });
}
