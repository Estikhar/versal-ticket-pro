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
  const [ready, setReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Map ko bade dibbe ke andar perfectly center aur fit karne ka logic
  useEffect(() => {
    function calculateLayout() {
      if (!containerRef.current || !mapRef.current) return;

      if (isZoomed) {
        setScale(1); // Zoom in par asli size
        setReady(true);
        return;
      }

      // Asli size naapne ke liye thodi der scale hatao
      const oldTransform = mapRef.current.style.transform;
      mapRef.current.style.transform = "none";

      const mWidth = mapRef.current.scrollWidth;
      const mHeight = mapRef.current.scrollHeight;
      const cWidth = containerRef.current.clientWidth;
      const cHeight = containerRef.current.clientHeight;

      mapRef.current.style.transform = oldTransform;

      if (mWidth > 0 && cWidth > 0 && cHeight > 0) {
        // 32px ki padding minus ki hai taaki map dibbe ke kinaro se na takraye
        const scaleX = (cWidth - 32) / mWidth;
        const scaleY = (cHeight - 32) / mHeight;
        
        // Jo side choti padegi, us hisaab se map scale down hoga (Perfect center fit)
        setScale(Math.min(scaleX, scaleY));
        setReady(true);
      }
    }

    const t = setTimeout(calculateLayout, 50);
    window.addEventListener("resize", calculateLayout);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", calculateLayout);
    };
  }, [isZoomed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", opacity: ready ? 1 : 0, transition: "opacity 0.2s" }}>
      
      {/* Top Header - Legend & Reset Button */}
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

      {/* 
        MAIN DIBBA (CONTAINER)
        Iski height fixed '60vh' kar di hai taaki screen ka khali space bhar jaye!
      */}
      <div 
        ref={containerRef}
        className="map-scroll"
        onClick={() => {
          if (!isZoomed) setIsZoomed(true); // Map par kahin bhi tap karne par zoom hoga
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: '60vh', // Bada dibba
          minHeight: '400px',
          maxHeight: '700px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          overflow: isZoomed ? 'auto' : 'hidden', // Scroll sirf zoom hone par on
          display: 'flex',
          // FIX: Zoom nahi hai toh Center me rahega, Zoom hai toh Top-Left se scroll shuru hoga
          alignItems: isZoomed ? 'flex-start' : 'center',
          justifyContent: isZoomed ? 'flex-start' : 'center',
          cursor: isZoomed ? 'default' : 'zoom-in',
          touchAction: isZoomed ? 'auto' : 'none',
        }}
      >
        
        {/* THE SCALABLE MAP */}
        <div 
          ref={mapRef}
          style={{
            transform: `scale(${scale})`,
            // Zoom out par center se scale hoga, zoom in par top-left se expand hoga
            transformOrigin: isZoomed ? 'top left' : 'center center',
            width: 'max-content',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: isZoomed ? '24px' : '0', // Zoom in karne par kinaro se thoda gap
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
                                price={prices[tier]} onToggle={onToggle} 
                                isZoomed={isZoomed} />
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

function Seat({ row, n, status, picked, price, tier, onToggle, isZoomed }: {
  row: string; n: number; status: SeatStatus; picked: boolean;
  price: number; tier: TierId; onToggle: (s: string) => void; isZoomed: boolean;
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
    <button type="button" 
            onClick={(e) => {
              // Agar map chota hai (Zoomed Out), toh seat select nahi hogi, balki map zoom in hoga
              if (!isZoomed) {
                e.preventDefault();
                return; 
              }
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
