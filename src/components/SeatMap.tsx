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
  const [mapDims, setMapDims] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function measureMap() {
      if (!mapRef.current || !containerRef.current) return;

      // Sahi size measure karne ke liye scale temporary hatayein
      const oldTransform = mapRef.current.style.transform;
      mapRef.current.style.transform = "none";

      const w = mapRef.current.scrollWidth;
      const h = mapRef.current.scrollHeight;
      const cWidth = containerRef.current.clientWidth;

      mapRef.current.style.transform = oldTransform; // Wapas apply karein

      if (w > 0 && cWidth > 0) {
        setMapDims({ w, h });
        // Screen ki width me se halki padding (16px) minus ki hai
        const availableWidth = cWidth - 16; 
        if (w > availableWidth) {
          setScale(availableWidth / w);
        } else {
          setScale(1);
        }
        setReady(true);
      }
    }

    // Load hone par aur screen size change hone par calculate karega
    const t = setTimeout(measureMap, 50);
    window.addEventListener("resize", measureMap);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measureMap);
    };
  }, []);

  return (
    <div style={{ width: "100%", opacity: ready ? 1 : 0, transition: "opacity 0.2s ease" }}>
      
      {/* Top Header: Legend aur Reset Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '36px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        
        {/* Reset View ab upar aayega taaki seats ko disturb na kare */}
        {isZoomed && (
          <button 
            type="button" 
            onClick={() => setIsZoomed(false)}
            style={{ 
              fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '8px', 
              background: '#F0A93B', color: '#090b10', border: 'none',
              fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(240, 169, 59, 0.3)'
            }}
          >
            🔍 Reset View
          </button>
        )}
      </div>

      {/* Main Map Scroll Container */}
      <div 
        ref={containerRef}
        className="map-scroll"
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: isZoomed ? '65vh' : 'none', // Zoom hone par scroll box banega
          overflow: isZoomed ? 'auto' : 'hidden',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: isZoomed ? '24px' : '8px',
          touchAction: isZoomed ? 'auto' : 'none', // Fit view me up/down scroll block nai karega
        }}
      >
        {/* Overlay Pulse Button */}
        {!isZoomed && (
          <div 
            onClick={() => setIsZoomed(true)}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 20, cursor: 'zoom-in',
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

        {/* Height Adjuster - Extra khali space ko fix karta hai */}
        <div 
          style={{
            width: isZoomed ? 'auto' : (mapDims.w > 0 ? mapDims.w * scale : 'auto'),
            height: isZoomed ? 'auto' : (mapDims.h > 0 ? mapDims.h * scale : 'auto'),
            margin: '0 auto',
          }}
        >
          {/* Actual Map Content */}
          <div 
            ref={mapRef}
            style={{
              transform: isZoomed ? 'none' : `scale(${scale})`,
              transformOrigin: 'top left',
              width: 'max-content',
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
