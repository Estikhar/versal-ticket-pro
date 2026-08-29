"use client";

import {
  ROW_IDS, ROW_LAYOUTS, ROW_TIER, TIER_ACCENT, TIER_ORDER, TIER_ROWS,
  MAX_ROW_UNITS, BLOCKED_SEATS, isGap, rowUnits, type TierId,
} from "@/lib/venue";
import { AVAILABLE, type SeatStatus } from "@/lib/types";

interface Props {
  statuses: Record<string, SeatStatus>;
  selected: Set<string>;
  prices: Record<TierId, number>;
  onToggle: (seat: string) => void;
}

/**
 * The Inder Dass Auditorium at its true geometry, straight off the plan.
 *
 * Every row is laid out on ONE shared seat-pitch grid and centred on the hall
 * axis, so blocks stack in register exactly as printed:
 *
 *   A-J  [20..11] <1> [10..1]                    21 units
 *   K,P  [14..8]  <6> [7..1]                     20 units  <- stairwell void
 *   L-O  [18..12] <1> [11..8] <1> [7..1]         20 units
 *   Q    [27..1]                                 27 units  <- continuous
 *
 * The 6-unit void on K and P is exactly gap + 4 centre seats + gap, which is
 * why K8 lands directly above L12 and K7 above L7. Sizing that void as two
 * plain aisles — the obvious shortcut — pulls the rear side blocks inward and
 * the whole rear section stops lining up.
 *
 * Pitch is seat width + margin, and gaps are N x pitch, so the grid holds at
 * every breakpoint without magic pixel values.
 */
export default function SeatMap({ statuses, selected, prices, onToggle }: Props) {
  return (
    <div>
      <div className="stage-wrap">
        <div className="stage"><span>STAGE</span></div>
      </div>

      {/* Prices ride in the legend now that the categories card is gone —
          a buyer still needs to know what a row costs before tapping it. */}
      <div className="legend">
        {TIER_ORDER.map((t) => (
          <span key={t} title={TIER_ROWS[t]}>
            <i style={{ background: `${TIER_ACCENT[t]}33`,
                        border: `1px solid ${TIER_ACCENT[t]}` }} />
            <b style={{ color: TIER_ACCENT[t], fontWeight: 900 }}>{t}</b>
            &nbsp;₹{prices[t].toLocaleString("en-IN")}
          </span>
        ))}
      </div>
      <div className="legend">
        <span><i className="lg-free" />Available</span>
        <span><i className="lg-sel" />Selected</span>
        <span><i className="lg-gone" />Booked</span>
      </div>

      <div className="map-scroll">
        <div className="map-inner" style={{ ["--units" as string]: MAX_ROW_UNITS }}>
          {ROW_IDS.map((row) => {
            const cells = ROW_LAYOUTS[row];
            const tier = ROW_TIER[row];
            return (
              <div key={row} className="seat-row"
                   style={{ ["--tier-accent" as string]: TIER_ACCENT[tier] }}>
                <span className="row-label">{row}</span>
                <div className="row-seats"
                     style={{ width: `calc(${rowUnits(cells)} * var(--pitch))` }}>
                  {cells.map((cell, i) =>
                    isGap(cell) ? (
                      <span key={`g${i}`} className="aisle" aria-hidden
                            style={{ width: `calc(${cell.gap} * var(--pitch))` }} />
                    ) : (
                      <Seat key={`${row}${cell}`} row={row} n={cell} tier={tier}
                            status={statuses[`${row}${cell}`] ?? AVAILABLE}
                            picked={selected.has(`${row}${cell}`)}
                            price={prices[tier]} onToggle={onToggle} />
                    ),
                  )}
                </div>
                <span className="row-label row-label--right">{row}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Seat({ row, n, status, picked, price, tier, onToggle }: {
  row: string; n: number; status: SeatStatus; picked: boolean;
  price: number; tier: TierId; onToggle: (s: string) => void;
}) {
  const id = `${row}${n}`;
  const house = BLOCKED_SEATS.has(id);

  if (status !== AVAILABLE) {
    // A <span>, not a disabled <button>: unclickable and skipped by keyboard
    // navigation, so a screen-reader user never tabs through 170 dead seats.
    return (
      <span className="seat seat--gone" aria-label={`Seat ${id}, unavailable`}
            title={house ? `${id} · reserved for LTG` : `${id} · sold`}>
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => onToggle(id)}
            className={`seat ${picked ? "seat--sel" : "seat--free"}`}
            aria-pressed={picked}
            aria-label={`Seat ${id}, ${tier}, ₹${price}`}
            title={`${id} · ${tier} · ₹${price.toLocaleString("en-IN")}`}>
      {n}
    </button>
  );
}
