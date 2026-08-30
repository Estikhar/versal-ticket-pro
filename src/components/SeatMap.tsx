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

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current || !innerRef.current || isZoomed) return;
      
      // Original size naapne ke liye scale temporary hata dein
      innerRef.current.style.transform = "none";
      
      const cWidth = containerRef.current.clientWidth;
      const cHeight = containerRef.current.clientHeight;
      const mWidth = innerRef.current.offsetWidth;
      const mHeight = innerRef.current.offsetHeight;

      if (cWidth > 0 && mWidth > 0) {
        // Width aur Height dono ko check karke perfect scale nikalenge
        const scaleX = (cWidth * 0.95) / mWidth; // 95% taaki thodi padding bachi rahe
        const scaleY = (cHeight * 0.95) / mHeight;
        setScale(Math.min(scaleX, scaleY)); // Jo chota hoga wo apply hoga, jisse map kabhi katega nahi
      }
    }

    const timeout = setTimeout(updateScale, 50);
    window.addEventListener("resize", updateScale);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateScale);
    };
  }, [isZoomed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '32px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
      </div>

      {/* Main Container - Ab yeh poora empty space cover karega (60vh height) */}
      <div 
        style={{
          position: 'relative',
          width: '100%',
          height: '60vh', // Mobile ki height ka 60% hissa cover karega
          minHeight: '400px',
          maxHeight: '600px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Floating Reset Button - Hamesha container ke andar bottom-right me rahega */}
        {isZoomed && (
          <button 
            type="button" 
            onClick={() => setIsZoomed(false)}
            style={{ 
              position: 'absolute', bottom: '16px', right: '16px', zIndex: 50,
              fontSize: '0.9rem', padding: '0.6rem 1.2rem', borderRadius: '12px', 
              background: '#F0A93B', color: '#090b10', border: 'none',
              fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.8)'
            }}
          >
            🔍 Reset View
          </button>
        )}

        {/* Click to Zoom Overlay */}
        {!isZoomed && (
          <div 
            onClick={() => setIsZoomed(true)}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 20, cursor: 'zoom-in', width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div className="zoom-btn" style={{
              background: '#F0A93B', color: '#090b10', padding: '14px 28px',
              borderRadius: '30px', fontWeight: 800, fontSize: '1rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
              textAlign: 'center'
            }}>
              Tap map to zoom & select
            </div>
          </div>
        )}

        {/* Actual Scrollable Area */}
        <div 
          ref={containerRef}
          className="map-scroll"
          style={{
            width: '100%',
            height: '100%',
            overflow: isZoomed ? 'auto' : 'hidden',
            display: 'flex',
            alignItems: isZoomed ? 'flex-start' : 'center',
            justifyContent: isZoomed ? 'flex-start' : 'center',
            touchAction: isZoomed ? 'auto' : 'none',
          }}
        >
          <div 
            ref={innerRef}
            style={{
              transform: isZoomed ? 'scale(1)' : `scale(${scale})`,
              transformOrigin: 'center',
              width: 'max-content',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: isZoomed ? '24px' : '0' // Zoom karne par corners pe chipkega nahi
            }}
          >
            <div className="stage-wrap" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
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
                         style={{ ["--tier-accent" as string]: TIER_ACCENT[tier], position: 'relative' }}>
                      
                      {/* FIXED: A B C D Row Labels ab Sticky hain (scroll karne par nahi chupenge) */}
                      <span className="row-label" style={{ position: 'sticky', left: 0, zIndex: 10, background: '#090b10', padding: '0 4px', borderRadius: '4px' }}>
                        {row}
                      </span>
                      
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
                      
                      <span className="row-label row-label--right" style={{ position: 'sticky', right: 0, zIndex: 10, background: '#090b10', padding: '0 4px', borderRadius: '4px' }}>
                        {row}
                      </span>
                      
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240, 169, 59, 0.6); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(240, 169, 59, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240, 169, 59, 0); }
        }
        .zoom-btn {
          animation: pulse 2s infinite ease-in-out;
        }
      `}} />
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
