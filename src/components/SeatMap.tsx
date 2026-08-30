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
  const [fitHeight, setFitHeight] = useState<string>('auto');

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Yeh map ke size ko hamesha perfectly calculate karega (Reset bug fix)
  useEffect(() => {
    function calculate() {
      if (!containerRef.current || !innerRef.current) return;

      const originalTransform = innerRef.current.style.transform;
      innerRef.current.style.transform = 'none'; // Temporarily hatao taaki sahi width mile

      const cWidth = containerRef.current.clientWidth;
      const iWidth = innerRef.current.scrollWidth;
      const iHeight = innerRef.current.scrollHeight;

      if (iWidth > cWidth && cWidth > 0) {
        const s = cWidth / iWidth;
        setFitScale(s);
        setFitHeight(`${iHeight * s}px`);
      } else {
        setFitScale(1);
        setFitHeight('auto');
      }

      innerRef.current.style.transform = originalTransform; // Wapas laga do
    }

    setTimeout(calculate, 50);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  return (
    <div>
      <div className="stage-wrap">
        <div className="stage"><span>STAGE</span></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '32px' }}>
        <div className="legend" style={{ margin: 0 }}>
          <span><i className="lg-free" />Available</span>
          <span><i className="lg-sel" />Selected</span>
          <span><i className="lg-gone" />Booked</span>
        </div>
        
        {isZoomed && (
          <button 
            type="button" 
            onClick={() => setIsZoomed(false)}
            style={{ 
              fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderRadius: '6px', 
              background: 'rgba(255, 242, 205, 0.15)', color: '#FFF2CD', border: 'none',
              fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            🔍 Reset View
          </button>
        )}
      </div>

      <div 
        ref={containerRef}
        className="map-scroll" 
        style={{ 
          overflowX: isZoomed ? 'auto' : 'hidden', 
          height: isZoomed ? 'auto' : fitHeight,
          transition: 'height 0.3s ease',
          width: '100%',
          position: 'relative',
          touchAction: isZoomed ? 'auto' : 'pan-y' // Mobile par swipe to scroll page fix
        }}
      >
        {!isZoomed && (
          <div 
            onClick={() => setIsZoomed(true)}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 20, cursor: 'zoom-in',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(9, 11, 16, 0.05)', // Transparent - map poora clear dikhega
            }}
          >
            <div className="zoom-btn" style={{
              background: '#F0A93B', color: '#090b10', padding: '12px 24px',
              borderRadius: '24px', fontWeight: 800, fontSize: '1rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              Tap map to zoom & select
            </div>
          </div>
        )}

        <div 
          ref={innerRef}
          style={{
            transform: isZoomed ? 'scale(1)' : `scale(${fitScale})`,
            transformOrigin: 'top left',
            width: 'max-content',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform'
          }}
        >
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
      
      {/* Pulse animation for the zoom button */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240, 169, 59, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(240, 169, 59, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(240, 169, 59, 0); }
        }
        .zoom-btn {
          animation: pulse 2s infinite;
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
