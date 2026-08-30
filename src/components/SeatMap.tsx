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
  const [wrapperSize, setWrapperSize] = useState({ w: "auto", h: "auto" });

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateLayout() {
      if (!containerRef.current || !mapRef.current) return;
      
      if (isZoomed) {
        setScale(1);
        setWrapperSize({ w: "auto", h: "auto" });
        return;
      }

      // Sahi size naapne ke liye scale temporary hatao
      mapRef.current.style.transform = "none";
      
      const containerWidth = containerRef.current.clientWidth;
      const realMapWidth = mapRef.current.scrollWidth;
      const realMapHeight = mapRef.current.scrollHeight;

      if (realMapWidth > 0 && containerWidth > 0) {
        // Map ko dibbe ki 95% width me fit karo taaki thodi jagah bache
        const newScale = (containerWidth * 0.95) / realMapWidth;
        setScale(newScale);
        
        // Dibbe ke andar ki khali jagah (extra height) ko exact fit karo
        setWrapperSize({ 
          w: `${realMapWidth * newScale}px`, 
          h: `${realMapHeight * newScale}px` 
        });
      }
    }

    const timeout = setTimeout(updateLayout, 50);
    window.addEventListener("resize", updateLayout);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateLayout);
    };
  }, [isZoomed]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
      </div>

      {/* MAIN CONTAINER (Bada Dibba) */}
      <div 
        style={{
          position: 'relative',
          width: '100%',
          height: '65vh', // Screen ka 65% height lega (Bada Size)
          minHeight: '450px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* RESET BUTTON - Hamesha corner me fix rahega */}
        {isZoomed && (
          <button 
            type="button" 
            onClick={() => setIsZoomed(false)}
            style={{ 
              position: 'absolute', bottom: '16px', right: '16px', zIndex: 50,
              fontSize: '0.9rem', padding: '0.6rem 1.2rem', borderRadius: '12px', 
              background: '#F0A93B', color: '#090b10', border: 'none',
              fontWeight: '800', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.7)'
            }}
          >
            🔍 Reset View
          </button>
        )}

        {/* OVERLAY - Click karne par zoom hoga */}
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

        {/* SCROLLABLE AREA */}
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
            padding: isZoomed ? '24px' : '0',
            touchAction: isZoomed ? 'auto' : 'none',
          }}
        >
          {/* EXACT FIT SIZING WRAPPER */}
          <div style={{ width: wrapperSize.w, height: wrapperSize.h }}>
            
            {/* ORIGINAL MAP (No Sticky Bugs) */}
            <div 
              ref={mapRef}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: 'max-content',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform'
              }}
            >
              <div className="stage-wrap" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
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
