import { NextResponse } from "next/server";
import { allSeats, getPrices } from "@/lib/store";
import { AVAILABLE } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Public map state. Only the status is exposed — sending whole rows would put
 * every buyer's name and phone in front of anyone who opens devtools.
 *
 * Failures return a readable message rather than a bare 500, because the client
 * cannot tell an empty map from a sold-out hall: that ambiguity is what left
 * the booking button stuck on "SOLD OUT" with no explanation.
 */
export async function GET() {
  try {
    const [rows, prices] = await Promise.all([allSeats(), getPrices()]);
    if (!rows.length) {
      return NextResponse.json(
        { error: "The seat table is empty. Open /admin → DANGER and reset the house." },
        { status: 503 },
      );
    }
    const statuses: Record<string, string> = {};
    for (const r of rows) {
      statuses[r.seat_id] = r.status === AVAILABLE ? AVAILABLE : "Booked";
    }
    return NextResponse.json({ statuses, prices });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      { error: `Storage unreachable — ${detail}. If you set the Supabase variables, run supabase/schema.sql first.` },
      { status: 503 },
    );
  }
}
