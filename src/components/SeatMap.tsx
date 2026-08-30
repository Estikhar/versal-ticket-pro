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
  const mapRef = useRef<HTMLDivElement>(null);

  // Map ko screen me properly fit karne ka perfect formula
  useEffect(() => {
    function calculateScale() {
      if (!containerRef.current || !mapRef.current) return;

      const cWidth = containerRef.current.clientWidth;
      const cHeight = containerRef.current.clientHeight;
      const mWidth = mapRef.current.offsetWidth;
      const mHeight = mapRef.current.offsetHeight;

      if (cWidth > 0 && mWidth > 0) {
        const scaleX = cWidth / mWidth;
        const scaleY = cHeight / mHeight;
        // 0.92 isliye rakha taaki map border se na takraye (Safe Margin)
        setScale(Math.min(scaleX, scaleY) * 0.92); 
      }
    }

    const t = setTimeout(calculateScale, 10);
    window.addEventListener("resize", calculateScale);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", calculateScale);
    };
  }, [isZoomed]); // Jab bhi zoom in/out hoga, scale recalculate hoga

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      
      {/* HEADER: Legend & Reset Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '36px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        
        {/* FIX: Button ki jagah div use kiya hai taaki wo chauda (wide) na ho */}
        {isZoomed && (
          <div 
            onClick={() => setIsZoomed(false)}
            style={{ 
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: '#F0A93B', color: '#000',
              padding: '6px 14px', borderRadius: '8px', 
              fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
              width: 'max-content', whiteSpace: 'nowrap', // Chauda hone se rokega
              boxShadow: '0 4px 10px rgba(240, 169, 59, 0.3)'
            }}
          >
            🔍 Reset View
          </div>
        )}
      </div>

      {/* 
        MAIN DIBBA (CONTAINER): 
        Iska size bada (65vh) kar diya hai taaki Back button theek bottom pe jaye 
        aur koi bekar khali space na bache!
      */}
      <div 
        ref={containerRef}
        className="map-scroll"
        style={{
          position: 'relative',
          width: '100%',
          height: '65vh', // Screen ka max hissa cover karega
          minHeight: '450px',
          maxHeight: '700px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          overflow: isZoomed ? 'auto' : 'hidden', // Scroll sirf zoom pe on hoga
          display: 'flex',
          // Zoomed In -> Left Top se shuru, Zoomed Out -> Center
          alignItems: isZoomed ? 'flex-start' : 'center',
          justifyContent: isZoomed ? 'flex-start' : 'center',
          touchAction: isZoomed ? 'auto' : 'none',
        }}
      >
        
        {/* MAP SCALING WRAPPER */}
        <div 
          style={{
            transform: isZoomed ? 'none' : `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            // FIX: Row Labels (A,B,C) kinare se chipke na, isliye badi padding (40px)
            padding: isZoomed ? '40px 32px' : '0', 
            width: 'max-content',
          }}
        >
          {/* THE ACTUAL MAP */}
          <div ref={mapRef} style={{ width: 'max-content' }}>
            
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

        {/* TAP TO ZOOM OVERLAY */}
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
