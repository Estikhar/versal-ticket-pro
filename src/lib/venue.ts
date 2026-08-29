/**
 * EXACT PORT of ROW_LAYOUTS from the Streamlit build.
 *
 * "AISLE" markers are preserved verbatim — they render as invisible spacers,
 * which is what gives the map its real gangway geometry. Row K and P carry a
 * DOUBLE aisle; row Q is split into three blocks by two aisles. Do not
 * "tidy" these: they mirror the printed plan.
 */
/**
 * A row is a sequence of seat numbers and GAPS, where a gap is measured in
 * SEAT-PITCH UNITS. Measuring gaps in units (not pixels) is what makes the
 * blocks line up vertically the way they do on the printed plan.
 *
 * Read straight off the PDF (block counts verified against the text layer):
 *   A-J   {11..20} left · {1..10} right            10 rows x 20 seats
 *   K, P  {8..14}  left · {1..7}   right            2 rows x 14 seats
 *   L-O   {12..18} left · {8..11} centre · {1..7}   4 rows x 18 seats
 *   Q     {1..27}, ONE continuous row               1 row  x 27 seats
 *
 * The centre gap on K and P is 6 units wide — exactly gap(1) + 4 centre seats
 * + gap(1) — so K8 sits directly above L12 and K7 above L7. That is the
 * stairwell void on the plan, and it is why K and P look narrower than L-O
 * while their side blocks stay in register.
 */
export type Gap = { gap: number };
export type Cell = number | Gap;
export type TierId = "VVIP" | "VIP" | "PREMIUM";

export const isGap = (c: Cell): c is Gap => typeof c === "object";

const seats = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let n = to; n >= from; n -= 1) out.push(n);   // printed right-to-left
  return out;
};

/** A-J: left 20->11 | centre aisle | right 10->1  = 21 units */
const FRONT: Cell[] = [...seats(11, 20), { gap: 1 }, ...seats(1, 10)];

/** K, P: left 14->8 | stairwell void | right 7->1 = 20 units */
const REAR_SIDE: Cell[] = [...seats(8, 14), { gap: 6 }, ...seats(1, 7)];

/** L-O: left 18->12 | aisle | centre 11->8 | aisle | right 7->1 = 20 units */
const REAR_MID: Cell[] = [
  ...seats(12, 18), { gap: 1 }, ...seats(8, 11), { gap: 1 }, ...seats(1, 7),
];

/** Q: one unbroken rear row, 27->1 = 27 units. The PDF prints no gap here. */
const REAR_BACK: Cell[] = seats(1, 27);

export const ROW_LAYOUTS: Record<string, Cell[]> = {
  A: FRONT, B: FRONT, C: FRONT, D: FRONT, E: FRONT,
  F: FRONT, G: FRONT, H: FRONT, I: FRONT, J: FRONT,
  K: REAR_SIDE,
  L: REAR_MID, M: REAR_MID, N: REAR_MID, O: REAR_MID,
  P: REAR_SIDE,
  Q: REAR_BACK,
};

/** Total width of a row in seat-pitch units — drives centring and min-width. */
export const rowUnits = (cells: Cell[]): number =>
  cells.reduce<number>((n, c) => n + (isGap(c) ? c.gap : 1), 0);

export const ROW_IDS = Object.keys(ROW_LAYOUTS);

export const SEAT_ORDER: string[] = ROW_IDS.flatMap((row) =>
  ROW_LAYOUTS[row].filter((c): c is number => !isGap(c)).map((n) => `${row}${n}`),
);
export const SEAT_RANK: Record<string, number> =
  Object.fromEntries(SEAT_ORDER.map((s, i) => [s, i]));
export const TOTAL_SEATS = SEAT_ORDER.length;              // 327

/**
 * HOUSE BLOCK — the blueprint prints exactly one instruction:
 *   "NOTE: D11 TO D20 RESERVED FOR LTG"
 * so that is the only reserved block. The earlier build also blocked A6-14,
 * G1-14, H1-10 and the whole of K-Q (170 seats, leaving 157 sellable); those
 * are gone, which takes sellable capacity to 317.
 */
const PRE_BLOCKED_RANGES: Record<string, [number, number]> = {
  D: [11, 21],   // inclusive:exclusive, like Python range()
};

const requested = new Set<string>();
for (const [row, [from, to]] of Object.entries(PRE_BLOCKED_RANGES)) {
  for (let n = from; n < to; n += 1) requested.add(`${row}${n}`);
}
export const BLOCKED_SEATS = new Set(
  [...requested].filter((s) => s in SEAT_RANK),
);
export const SELLABLE_SEATS = TOTAL_SEATS - BLOCKED_SEATS.size;   // 317
export const BLOCKED_MARK = "-- HOUSE BLOCK --";

/** Tier accent colours, used by the map to colour-code rows. */
export const TIER_ACCENT: Record<TierId, string> = {
  VVIP: "#D4AF37", VIP: "#6EA8FF", PREMIUM: "#34D07A",
};

/** Widest row drives the horizontal scroller. Q, at 27 units. */
export const MAX_ROW_UNITS = Math.max(
  ...Object.values(ROW_LAYOUTS).map(rowUnits),
);

export const ROW_TIER: Record<string, TierId> = {
  A: "VVIP", B: "VVIP",
  C: "VIP", D: "VIP", E: "VIP", F: "VIP", G: "VIP",
  H: "PREMIUM", I: "PREMIUM", J: "PREMIUM", K: "PREMIUM", L: "PREMIUM",
  M: "PREMIUM", N: "PREMIUM", O: "PREMIUM", P: "PREMIUM", Q: "PREMIUM",
};
export const TIER_ORDER: TierId[] = ["VVIP", "VIP", "PREMIUM"];
export const DEFAULT_PRICES: Record<TierId, number> =
  { VVIP: 5000, VIP: 2400, PREMIUM: 1000 };
export const TIER_ROWS: Record<TierId, string> =
  { VVIP: "Rows A–B", VIP: "Rows C–G", PREMIUM: "Rows H–Q" };

export const seatRow = (id: string) => id.slice(0, 1).toUpperCase();
export const seatTier = (id: string): TierId => ROW_TIER[seatRow(id)] ?? "PREMIUM";
