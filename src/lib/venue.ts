/**
 * EXACT PORT of ROW_LAYOUTS from the Streamlit build.
 *
 * "AISLE" markers are preserved verbatim — they render as invisible spacers,
 * which is what gives the map its real gangway geometry. Row K and P carry a
 * DOUBLE aisle; row Q is split into three blocks by two aisles. Do not
 * "tidy" these: they mirror the printed plan.
 */
/**
 * Row geometry, MEASURED off the blueprint — not estimated.
 *
 * Seat boxes are 50px and the seat pitch is 60px on the plan, so every gap
 * below is expressed in PITCH UNITS (1 unit = one seat step). Measured values:
 *
 *   front rows   [10] <3.3> [10]                         = 23.3 units
 *   K and P      [7]  <14.2> [7]                          = 28.2 units
 *   L-O          [7] <2.3> [2] <5.6> [2] <2.3> [7]        = 28.2 units
 *   Q            [27] continuous                          = 27.0 units
 *
 * Three things this corrects:
 *   1. The REAR IS WIDER THAN THE FRONT (28.2 vs 23.3). The earlier model had
 *      it narrower, which is why the hall looked wrong.
 *   2. The centre block on L-O is TWO PAIRS, not four seats in a run: the
 *      stairwell sits between 10 and 9, exactly as the PDF prints "11 10" and
 *      "9 8" as separate items.
 *   3. K and P's void is 14.2 units — precisely a+2+b+2+a — so their side
 *      blocks land in register with L-O's.
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

/** Measured gap widths, in seat-pitch units. */
const AISLE_FRONT = 3.3;   // centre aisle, rows A-J
const AISLE_REAR  = 2.3;   // between side block and centre pair, rows L-O
const STAIRWELL   = 5.6;   // between the two centre pairs, rows L-O
const VOID_KP     = AISLE_REAR * 2 + STAIRWELL + 4;  // 14.2 — the whole centre

/** A-J: left 20->11 | aisle | right 10->1 */
const FRONT: Cell[] = [
  ...seats(11, 20), { gap: AISLE_FRONT }, ...seats(1, 10),
];

/** K, P: left 14->8 | stairwell void | right 7->1 */
const REAR_SIDE: Cell[] = [
  ...seats(8, 14), { gap: VOID_KP }, ...seats(1, 7),
];

/** L-O: left 18->12 | aisle | 11 10 | stairwell | 9 8 | aisle | right 7->1 */
const REAR_MID: Cell[] = [
  ...seats(12, 18), { gap: AISLE_REAR },
  ...seats(10, 11), { gap: STAIRWELL }, ...seats(8, 9),
  { gap: AISLE_REAR }, ...seats(1, 7),
];

/** Q: one unbroken rear row, 27->1. The PDF prints no gap here. */
const REAR_BACK: Cell[] = seats(1, 27);

export const ROW_LAYOUTS: Record<string, Cell[]> = {
  A: FRONT, B: FRONT, C: FRONT, D: FRONT, E: FRONT,
  F: FRONT, G: FRONT, H: FRONT, I: FRONT, J: FRONT,
  K: REAR_SIDE,
  L: REAR_MID, M: REAR_MID, N: REAR_MID, O: REAR_MID,
  P: REAR_SIDE,
  Q: REAR_BACK,
};

/** Total width of a row in seat-pitch units. */
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
