/**
 * Data layer — a direct mirror of the Streamlit build's logic.
 *
 *   JSON file  — zero setup, so `npm run dev` works immediately.
 *   Supabase   — production.
 *
 * Status strings, the house-block marker, the read-after-write verify and the
 * check-in messages are all ported verbatim so behaviour is identical.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  SEAT_ORDER, BLOCKED_SEATS, BLOCKED_MARK, SEAT_RANK,
  seatTier, TIER_ORDER, DEFAULT_PRICES, type TierId,
} from "./venue";
import { AVAILABLE, PENDING, BOOKED, type SeatRecord, type SeatStatus } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const usingSupabase = Boolean(URL && KEY);
const sb = () => createClient(URL, KEY, { auth: { persistSession: false } });

const SEATS_FILE = path.join(process.cwd(), ".data", "seats.json");
const PRICES_FILE = path.join(process.cwd(), ".data", "prices.json");
const WRITE_ATTEMPTS = 4;

/** Python now_ist() — dd-mm-yyyy HH:MM:SS, Asia/Kolkata. */
export function nowIst(): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}-${g("month")}-${g("year")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

/** Python blank_layout(): blocked seats are seeded as Booked + house marker. */
function seed(): SeatRecord[] {
  return SEAT_ORDER.map((seat_id) => {
    const blocked = BLOCKED_SEATS.has(seat_id);
    return {
      seat_id,
      status: (blocked ? BOOKED : AVAILABLE) as SeatStatus,
      name: blocked ? BLOCKED_MARK : "",
      phone: "", utr_number: "",
      booked_at: blocked ? nowIst() : "",
      checkin_time: "",
    };
  });
}

async function readJson<T>(file: string, fallback: () => T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, "utf8")) as T; }
  catch { const v = fallback(); await writeJson(file, v); return v; }
}
async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

export async function allSeats(): Promise<SeatRecord[]> {
  if (!usingSupabase) return readJson(SEATS_FILE, seed);
  const { data, error } = await sb().from("seats").select("*");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    const s = seed();
    const ins = await sb().from("seats").insert(s);
    if (ins.error) throw new Error(`Seeding failed: ${ins.error.message}`);
    return s;
  }
  return data as SeatRecord[];
}
/**
 * A swallowed write error was the worst bug in this file: the upsert would be
 * rejected (wrong key, RLS policy, missing table), nothing changed, the
 * read-back never matched, and the retry loop reported "High demand right now
 * — someone grabbed a seat". A database permission problem was being shown to
 * buyers as a race they could not win. Writes now throw with the real reason.
 */
async function persist(rows: SeatRecord[]) {
  if (!usingSupabase) return writeJson(SEATS_FILE, rows);
  const { error } = await sb().from("seats").upsert(rows, { onConflict: "seat_id" });
  if (error) throw new Error(`Seat write rejected: ${error.message}`);
}
export async function resetHouse(): Promise<void> {
  if (!usingSupabase) return writeJson(SEATS_FILE, seed());
  const del = await sb().from("seats").delete().neq("seat_id", "");
  if (del.error) throw new Error(`Reset failed: ${del.error.message}`);
  const ins = await sb().from("seats").insert(seed());
  if (ins.error) throw new Error(`Seeding failed: ${ins.error.message}`);
}

/** Python is_house_block(). */
export const isHouseBlock = (r: SeatRecord) =>
  r.name.trim() === BLOCKED_MARK || BLOCKED_SEATS.has(r.seat_id.toUpperCase());

// ------------------------------------------------------------------ pricing
export async function getPrices(): Promise<Record<TierId, number>> {
  if (!usingSupabase) {
    const raw = await readJson(PRICES_FILE, () => ({ ...DEFAULT_PRICES }));
    return { ...DEFAULT_PRICES, ...raw };
  }
  const { data } = await sb().from("settings").select("tier,price");
  const out = { ...DEFAULT_PRICES };
  for (const tier of TIER_ORDER) {
    const hit = data?.find((r: { tier: string; price: string }) =>
      String(r.tier).trim().toUpperCase() === tier);
    const n = Number(String(hit?.price ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(n) && n >= 0) out[tier] = Math.round(n);
  }
  return out;
}
export async function setPrices(next: Record<TierId, number>): Promise<void> {
  const clean = { ...DEFAULT_PRICES };
  for (const t of TIER_ORDER) {
    const n = Number(next[t]);
    if (Number.isFinite(n) && n >= 0 && n <= 1_000_000) clean[t] = Math.round(n);
  }
  if (!usingSupabase) return writeJson(PRICES_FILE, clean);
  const { error } = await sb().from("settings").upsert(
    TIER_ORDER.map((t) => ({ tier: t, price: String(clean[t]) })), { onConflict: "tier" });
  if (error) throw new Error(`Price write rejected: ${error.message}`);
}

// ------------------------------------------------------------------ booking
export const availableSeats = (rows: SeatRecord[]) =>
  rows.filter((r) => r.status === AVAILABLE).map((r) => r.seat_id)
      .sort((a, b) => (SEAT_RANK[a] ?? 1e6) - (SEAT_RANK[b] ?? 1e6));

export const findByPhone = (rows: SeatRecord[], phone: string) =>
  rows.filter((r) => r.phone === phone && (r.status === PENDING || r.status === BOOKED))
      .sort((a, b) => (SEAT_RANK[a.seat_id] ?? 1e6) - (SEAT_RANK[b.seat_id] ?? 1e6));

/**
 * Python reserve_multiple_seats(): all-or-nothing.
 *
 * Every seat must still be Available, and the UTR must be unused. It writes,
 * then reads back to confirm the UTR actually landed — retrying up to four
 * times. Nothing is partially booked: if one seat in the basket has gone, the
 * whole submission is refused so the buyer is never charged for a split order.
 */
export async function reserveMultipleSeats(
  seatIds: string[], name: string, phone: string, utr: string,
): Promise<{ ok: boolean; message: string }> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const rows = await allSeats();
    if (!rows.length) return { ok: false, message: "Seat database is empty. Ask the organiser." };

    if (rows.some((r) => r.utr_number === utr && utr !== "")) {
      return { ok: false, message: "That UTR has already been used. Please use a unique UTR." };
    }
    for (const seat of seatIds) {
      const row = rows.find((r) => r.seat_id === seat);
      if (!row) return { ok: false, message: `Seat ${seat} is not in the seating plan.` };
      if (row.status !== AVAILABLE) {
        return { ok: false,
                 message: `Seat ${seat} was taken while you were deciding. Please pick another.` };
      }
    }

    const stamp = nowIst();
    for (const seat of seatIds) {
      const row = rows.find((r) => r.seat_id === seat)!;
      Object.assign(row, { status: PENDING, name, phone, utr_number: utr,
                           booked_at: stamp, checkin_time: "" });
    }
    await persist(rows);

    const confirm = await allSeats();
    const stuck = seatIds.every((seat) =>
      confirm.find((r) => r.seat_id === seat)?.utr_number === utr);
    if (stuck) return { ok: true, message: "Seats held for verification." };
  }
  // Reaching here means the write went through but the read-back never
  // confirmed it, four times over. That is a storage problem, not demand.
  return { ok: false,
           message: "Could not confirm the booking with the database. Nothing was charged — please try again, and tell the organiser if it repeats." };
}

/** Python set_status(): approve -> Booked, reject -> Available with the row wiped. */
export async function setStatus(
  seatId: string, next: SeatStatus,
): Promise<{ ok: boolean; message: string }> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const rows = await allSeats();
    const row = rows.find((r) => r.seat_id === seatId);
    if (!row) return { ok: false, message: `Seat ${seatId} not found.` };

    if (next === BOOKED) {
      row.status = BOOKED;
      if (!row.booked_at.trim()) row.booked_at = nowIst();
    } else if (next === AVAILABLE) {
      Object.assign(row, { status: AVAILABLE, name: "", phone: "",
                           utr_number: "", booked_at: "", checkin_time: "" });
    } else {
      return { ok: false, message: `Unsupported status ${next}.` };
    }
    await persist(rows);

    const back = await allSeats();
    if (back.find((r) => r.seat_id === seatId)?.status === next) {
      return { ok: true, message: `${seatId} -> ${next.replace(/_/g, " ")}.` };
    }
  }
  return { ok: false, message: "Write did not stick — please retry." };
}

/** Python check_in() — message strings kept verbatim. */
export async function checkIn(seatId: string) {
  const rows = await allSeats();
  const row = rows.find((r) => r.seat_id === seatId.toUpperCase());
  if (!row) return { ok: false, message: `${seatId} is not in the plan.`, row: null };
  if (isHouseBlock(row)) return { ok: false, message: `${seatId} is a house block.`, row };
  if (row.status === AVAILABLE) return { ok: false, message: `${seatId} has not been sold.`, row };
  if (row.status === PENDING) return { ok: false, message: `${seatId} is awaiting verification.`, row };
  if (row.status !== BOOKED) return { ok: false, message: `${seatId} is not a valid pass.`, row };
  if (row.checkin_time.trim()) {
    return { ok: false, message: `ALREADY CHECKED IN at ${row.checkin_time}.`, row };
  }
  row.checkin_time = nowIst();
  await persist(rows);
  return { ok: true, message: `ADMIT — ${row.name} · ${seatId}`, row };
}

/** Python seat_from_payload(). */
export function seatFromPayload(text: string): string | null {
  const m = /Seat:\s*([A-Q]\d{1,2})/i.exec(text ?? "");
  return m ? m[1].toUpperCase() : null;
}

/** Python gate_payload(). */
export function gatePayload(r: SeatRecord, eventName: string, mapsUrl: string) {
  const parts = ["PASS", eventName, `Seat: ${r.seat_id}`,
                 `Name: ${r.name}`, `Phone: ${r.phone}`];
  if (mapsUrl) parts.push(`Maps: ${mapsUrl}`);
  return parts.join(" | ");
}
