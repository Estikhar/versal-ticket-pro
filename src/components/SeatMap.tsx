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
  const [fitScale, setFitScale] = useState(1);
  const [fitHeight, setFitHeight] = useState(300); // Default height before calculation

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Yeh logic map ke shrink hone par uski perfect height calculate karega taaki neeche khali jagah na bache
  useEffect(() => {
    function calculateSize() {
      if (!wrapperRef.current || !mapRef.current) return;
      
      // Original size naapne ke liye temporarily scale hatana zaroori hai
      const prevTransform = mapRef.current.style.transform;
      mapRef.current.style.transform = 'none';
      
      const containerWidth = wrapperRef.current.clientWidth;
      const actualMapWidth = mapRef.current.scrollWidth;
      const actualMapHeight = mapRef.current.scrollHeight;
      
      mapRef.current.style.transform = prevTransform;
      
      if (actualMapWidth > 0 && containerWidth > 0) {
        const scaleValue = containerWidth / actualMapWidth;
        setFitScale(scaleValue);
        // Map jitna shrink hua hai, container ki height bhi theek utni hi set hogi
        setFitHeight(actualMapHeight * scaleValue);
      }
    }
    
    // Page load hote hi aur screen rotate hone par run hoga
    const timeoutId = setTimeout(calculateSize, 10);
    window.addEventListener('resize', calculateSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculateSize);
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      
      {/* Top Header: Legend & Reset Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '36px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        
        {/* Reset View Button ab theek Available/Booked ke samne hoga, taaki map ke upar na aaye */}
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

      {/* Main Container Box */}
      <div 
        ref={wrapperRef}
        className="map-scroll"
        style={{
          position: 'relative',
          width: '100%',
          // Yahan Magic Fix hai: Zoom out par perfect height, aur Zoom In par scrollable 65vh height
          height: isZoomed ? '65vh' : `${fitHeight}px`, 
          overflow: isZoomed ? 'auto' : 'hidden',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          transition: 'height 0.3s ease',
          touchAction: isZoomed ? 'auto' : 'pan-y'
        }}
      >
        {/* Tap to Zoom Overlay */}
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
            }}>
              Tap map to zoom & select
            </div>
          </div>
        )}

        {/* The Actual Map */}
        <div 
          ref={mapRef}
          style={{
            transform: isZoomed ? 'scale(1)' : `scale(${fitScale})`,
            transformOrigin: 'top left',
            width: 'max-content',
            transition: 'transform 0.3s ease',
            padding: isZoomed ? '24px' : '0' // Zoom hone par kinare screen se na chipke, isliye halki padding
          }}
        >
          {/* Stage */}
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
                    
                    {/* Yahan se sticky position aur custom backgrounds hata diye gaye hain taaki overlaps na hon */}
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
