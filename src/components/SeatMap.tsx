"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ROW_IDS, ROW_LAYOUTS, ROW_TIER, TIER_ACCENT, TIER_ROWS,
  MAX_ROW_UNITS, BLOCKED_SEATS, isGap, rowUnits, type TierId,
} from "@/lib/venue";
import { AVAILABLE, type SeatStatus } from "@/lib/types";

interface Props {
  statuses: Record<string, SeatStatus>;
  selected: Set<string>;
  prices: Record<TierId, number>;
  onToggle: (seat: string) => void;
}

const MIN_SEAT = 18;
const MAX_SEAT = 46;

/**
 * The auditorium map.
 *
 * ZOOM CHANGES THE SEAT SIZE, NOT A CSS TRANSFORM. That is the whole trick
 * here, and it fixes three things at once:
 *
 *   - `transform: scale()` resamples everything, so seat numbers go blurry the
 *     moment you zoom out. Re-laying out at a smaller seat keeps text crisp.
 *   - A transform creates a containing block, which makes `position: sticky`
 *     latch onto it instead of the scroller — that is why the row letters ended
 *     up floating in the MIDDLE of each row instead of pinned to the left edge.
 *   - Scale-to-fit crushed seats to ~13px on a 390px phone. Below roughly 24px
 *     a target is neither readable nor reliably tappable, so the map now stays
 *     legible and pans sideways instead, which is what every real ticketing
 *     app does.
 *
 * The view also opens centred on the middle of the hall rather than at the far
 * left edge, and keeps that centre anchored while zooming.
 */
export default function SeatMap({ statuses, selected, prices, onToggle }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [seat, setSeat] = useState(26);
  const anchor = useRef<number | null>(null);

  // Start a little larger on a wide screen; a phone keeps the tappable default.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 900) setSeat(32);
  }, []);

  const centreOnce = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || centreOnce.current || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    centreOnce.current = true;
  }, [seat]);

  // Keep whatever is in the middle of the viewport in the middle after a zoom.
  const zoom = useCallback((delta: number) => {
    const el = scroller.current;
    if (el && el.scrollWidth > 0) {
      anchor.current = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
    }
    setSeat((s) => Math.min(MAX_SEAT, Math.max(MIN_SEAT, s + delta)));
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || anchor.current === null) return;
    el.scrollLeft = anchor.current * el.scrollWidth - el.clientWidth / 2;
    anchor.current = null;
  }, [seat]);

  return (
    <div>
      <div className="stage-wrap">
        <div className="stage"><span>STAGE</span></div>
      </div>

      <div className="map-bar">
        <div className="legend">
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        <div className="zoomer">
          <button type="button" onClick={() => zoom(-4)} disabled={seat <= MIN_SEAT}
                  aria-label="Zoom out">−</button>
          <span>{Math.round((seat / 26) * 100)}%</span>
          <button type="button" onClick={() => zoom(4)} disabled={seat >= MAX_SEAT}
                  aria-label="Zoom in">+</button>
        </div>
      </div>

      <div className="map-frame">
        <div className="map-scroll" ref={scroller}>
          <div className="map-inner"
               style={{ ["--units" as string]: MAX_ROW_UNITS,
                        ["--seat" as string]: `${seat}px`,
                        ["--gutter" as string]: `${Math.max(3, Math.round(seat * 0.16))}px` }}>
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
                      {cells.map((cell, k) =>
                        isGap(cell) ? (
                          <span key={`g${k}`} className="aisle" aria-hidden
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

      <p className="map-hint">Swipe the map sideways · pinch or use − / + to resize</p>
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
    // A span, not a disabled button: unclickable and skipped by keyboard
    // navigation, so nobody tabs through rows of dead seats.
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
