"use client";

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from "react";
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

/** Seat size the map is BUILT at. Everything on screen is this, transformed. */
const BASE_SEAT = 28;
/** Effective px at which seat numbers become worth drawing. */
const NUMBER_AT = 19;
const MAX_ZOOM = 5;
/** How far a tap on the overview zooms — enough for numbers and real targets. */
const ZOOM_STEP = 2.6;

/**
 * The auditorium — whole hall on one screen, then pinch to work.
 *
 * This is the pattern the big ticketing apps actually use, and I had it wrong
 * twice before. The mistake was insisting seat NUMBERS stay readable at
 * overview: that forces a large seat, which forces a map wider than the phone,
 * which forces side-panning — and panning a hall you cannot see the shape of
 * feels nothing like a real app.
 *
 * At overview the numbers are simply not drawn. You see the shape of the house,
 * which rows are open, and where the gaps are. Numbers fade in once you pinch
 * past ~19px effective, which is the point they become legible AND tappable.
 *
 * Zoom is a transform on a canvas layer, so it is GPU-composited and stays
 * smooth on a phone. Nothing inside uses `position: sticky` — a transform
 * creates a containing block and sticky latches onto it, which is exactly why
 * the row letters previously drifted into the middle of each row.
 */
export default function SeatMap({ statuses, selected, prices, onToggle }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [fit, setFit] = useState(1);
  const [k, setK] = useState(1);
  const kRef = useRef(1);
  const [t, setT] = useState({ x: 0, y: 0 });

  useEffect(() => { kRef.current = k; }, [k]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; k: number; cx: number; cy: number } | null>(null);
  const dragged = useRef(false);
  const lastTap = useRef(0);

  // Measure once, untransformed, then fit the hall to the viewport width.
  useLayoutEffect(() => {
    const vp = viewport.current, cv = canvas.current;
    if (!vp || !cv || nat.w) return;
    const w = cv.scrollWidth, h = cv.scrollHeight;
    if (!w || !h) return;
    setNat({ w, h });
    const f = (vp.clientWidth - 8) / w;
    setFit(f); setK(f);
    setT({ x: (vp.clientWidth - w * f) / 2, y: 0 });
  }, [nat.w]);

  const clamp = useCallback((nx: number, ny: number, nk: number) => {
    const vp = viewport.current;
    if (!vp || !nat.w) return { x: nx, y: ny };
    const cw = nat.w * nk, ch = nat.h * nk;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    return {
      x: cw <= vw ? (vw - cw) / 2 : Math.min(0, Math.max(vw - cw, nx)),
      y: ch <= vh ? (vh - ch) / 2 : Math.min(0, Math.max(vh - ch, ny)),
    };
  }, [nat]);

  /** Zoom about a point in viewport coordinates, so the pinch stays anchored. */
  const zoomAt = useCallback((nextK: number, px: number, py: number) => {
    setK((prev) => {
      const nk = Math.min(MAX_ZOOM, Math.max(fit, nextK));
      setT((cur) => clamp(px - (px - cur.x) * (nk / prev),
                          py - (py - cur.y) * (nk / prev), nk));
      return nk;
    });
  }, [fit, clamp]);

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y), k,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;

    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesture.current;
      dragged.current = true;
      zoomAt(g.k * (dist / g.dist), g.cx - rect.left, g.cy - rect.top);
      return;
    }

    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    // Only claim the gesture once it is clearly a drag, so a tap still reaches
    // the seat button underneath.
    if (!dragged.current && Math.hypot(dx, dy) < 5) return;
    dragged.current = true;
    setT((cur) => clamp(cur.x + dx, cur.y + dy, k));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;

    if (dragged.current) return;

    // Overview: a 10px seat is not a tap target, so a tap anywhere zooms into
    // that spot instead. Seats are pointer-events:none until then, which is
    // what stops a stray tap from booking a seat the buyer cannot even read.
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left, py = e.clientY - rect.top;

    if (!detailNow()) { zoomAt(fit * ZOOM_STEP, px, py); return; }

    // Zoomed in: taps belong to the seats. Double-tap returns to the full view.
    const now = Date.now();
    if (now - lastTap.current < 300) { reset(); lastTap.current = 0; }
    else lastTap.current = now;
  }

  function onWheel(e: React.WheelEvent) {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(k * (e.deltaY < 0 ? 1.12 : 0.89),
           e.clientX - rect.left, e.clientY - rect.top);
  }

  const detail = k * BASE_SEAT >= NUMBER_AT;
  const detailNow = () => kRef.current * BASE_SEAT >= NUMBER_AT;

  const reset = useCallback(() => {
    const vp = viewport.current;
    if (!vp || !nat.w) return;
    setK(fit);
    setT({ x: (vp.clientWidth - nat.w * fit) / 2, y: 0 });
  }, [fit, nat.w]);

  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    // React attaches wheel passively; a non-passive listener is required to
    // stop the page scrolling while zooming the map.
    const stop = (ev: WheelEvent) => ev.preventDefault();
    vp.addEventListener("wheel", stop, { passive: false });
    return () => vp.removeEventListener("wheel", stop);
  }, []);

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

      <div className="map-viewport" ref={viewport}
           style={{ height: nat.h ? nat.h * fit + 8 : 260 }}
           onPointerDown={onPointerDown} onPointerMove={onPointerMove}
           onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
           onWheel={onWheel}>
        <div ref={canvas}
             className={`map-canvas${detail ? " detail" : ""}`}
             style={nat.w
               ? { transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${k})` }
               : undefined}>
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
                      {cells.map((cell, c) =>
                        isGap(cell) ? (
                          <span key={`g${c}`} className="aisle" aria-hidden
                                style={{ width: `calc(${cell.gap} * var(--pitch))` }} />
                        ) : (
                          <Seat key={`${row}${cell}`} row={row} n={cell} tier={tier}
                                status={statuses[`${row}${cell}`] ?? AVAILABLE}
                                picked={selected.has(`${row}${cell}`)}
                                price={prices[tier]}
                                onPick={(id) => { if (!dragged.current) onToggle(id); }} />
                        ),
                      )}
                    </div>
                    <span className="row-label">{row}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {detail ? (
          <button type="button" className="map-reset"
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={reset}>⤢ Full view</button>
        ) : (
          <p className="map-nudge">Tap the map to zoom in and pick your seats</p>
        )}
      </div>
    </div>
  );
}

function Seat({ row, n, status, picked, price, tier, onPick }: {
  row: string; n: number; status: SeatStatus; picked: boolean;
  price: number; tier: TierId; onPick: (s: string) => void;
}) {
  const id = `${row}${n}`;
  const house = BLOCKED_SEATS.has(id);

  if (status !== AVAILABLE) {
    return (
      <span className="seat seat--gone" aria-label={`Seat ${id}, unavailable`}
            title={house ? `${id} · reserved for LTG` : `${id} · sold`} />
    );
  }
  return (
    <button type="button" onClick={() => onPick(id)}
            className={`seat ${picked ? "seat--sel" : "seat--free"}`}
            aria-pressed={picked}
            aria-label={`Seat ${id}, ${tier}, ₹${price}`}
            title={`${id} · ${tier} · ₹${price.toLocaleString("en-IN")}`}>
      <b>{n}</b>
    </button>
  );
}
