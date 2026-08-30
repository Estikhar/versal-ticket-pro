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

export default function SeatMap({ statuses, selected, prices, onToggle }: Props) {
  return (
    <div>
      <div className="stage-wrap">
        <div className="stage"><span>STAGE</span></div>
      </div>

      <div className="legend">
        <span><i className="lg-free" />Available</span>
        <span><i className="lg-sel" />Selected</span>
        <span><i className="lg-gone" />Booked</span>
      </div>

      <div className="map-scroll">
        <div className="map-inner" style={{ ["--units" as string]: MAX_ROW_UNITS }}>
          {ROW_IDS.map((row, i) => {
            const cells = ROW_LAYOUTS[row];
            const tier = ROW_TIER[row];
            const bandHere = i === 0 || ROW_TIER[ROW_IDS[i - 1]] !== tier;
            return (
              <div key={row} className="contents">
              {bandHere && (
                <div className="tier-band"
                     style={{ ["--tier-accent" as string]: TIER_ACCENT[tier] }}>
                  <span className="tier-band__line" />
                  <span className="tier-band__text">
                    {tier} · ₹{prices[tier].toLocaleString("en-IN")}
                    <em>{TIER_ROWS[tier]}</em>
                  </span>
                  <span className="tier-band__line" />
                </div>
              )}
              <div className="seat-row"
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
