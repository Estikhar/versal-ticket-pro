"use client";

import { useState, useRef, useEffect } from "react";
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
  const [isZoomed, setIsZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Map ko screen me perfect fit karne ka formula (No extra empty space)
  useEffect(() => {
    function measurePerfectFit() {
      if (!containerRef.current || !mapRef.current) return;

      // Original size naapne ke liye temporarily scale hatao
      const oldTransform = mapRef.current.style.transform;
      mapRef.current.style.transform = "none";

      const mWidth = mapRef.current.scrollWidth;
      const mHeight = mapRef.current.scrollHeight;
      const cWidth = containerRef.current.clientWidth;

      mapRef.current.style.transform = oldTransform; // Wapas scale lagao

      if (mWidth > 0 && cWidth > 0) {
        setBaseSize({ w: mWidth, h: mHeight });
        // Map ko screen ki width ke hisaab se exactly fit karo
        setScale(cWidth / mWidth);
        setReady(true);
      }
    }

    const t = setTimeout(measurePerfectFit, 50);
    window.addEventListener("resize", measurePerfectFit);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measurePerfectFit);
    };
  }, [isZoomed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", opacity: ready ? 1 : 0, transition: "opacity 0.2s" }}>
      
      {/* HEADER: Legend & Reset Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '36px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        
        {/* Reset View Button */}
        {isZoomed && (
          <div 
            onClick={() => setIsZoomed(false)}
            style={{ 
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: '#F0A93B', color: '#000',
              padding: '6px 14px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(240, 169, 59, 0.3)'
            }}
          >
            🔍 Reset View
          </div>
        )}
      </div>

      {/* MAIN CONTAINER */}
      <div 
        ref={containerRef}
        className="map-scroll"
        onClick={() => {
          if (!isZoomed) setIsZoomed(true); // Kahin bhi tap karne par zoom ho jayega
        }}
        style={{
          position: 'relative',
          width: '100%',
          // FIX: Jab zoom nahi hai, toh height exactly map ke barabar hogi = No Empty Space!
          // Jab zoom hai, toh height 60vh (Scrollable Box) ban jayegi
          height: isZoomed ? '60vh' : `${baseSize.h * scale}px`, 
          overflow: isZoomed ? 'auto' : 'hidden', 
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          cursor: isZoomed ? 'default' : 'zoom-in',
          touchAction: isZoomed ? 'auto' : 'pan-y',
        }}
      >
        {/* ACTUAL SCALABLE MAP */}
        <div 
          ref={mapRef}
          style={{
            transform: isZoomed ? 'none' : `scale(${scale})`,
            transformOrigin: 'top left',
            width: 'max-content',
            transition: 'transform 0.2s ease',
            padding: isZoomed ? '24px' : '0', // Zoom hone par map kinaro se na takraye
          }}
        >
          <div className="stage-wrap" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'center' }}>
            <div className="stage"><span>STAGE</span></div>
          </div>

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
    <button type="button" onClick={(e) => {
              // Zoom out me seat select hone se rokne ke liye event stop kiya
              e.stopPropagation();
              onToggle(id);
            }}
            className={`seat ${picked ? "seat--sel" : "seat--free"}`}
            aria-pressed={picked}
            aria-label={`Seat ${id}, ${tier}, ₹${price}`}
            title={`${id} · ${tier} · ₹${price.toLocaleString("en-IN")}`}>
      {n}
    </button>
  );
}
