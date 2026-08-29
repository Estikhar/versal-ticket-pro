"use client";

import Link from "next/link";
import { EVENT } from "@/lib/config";

/**
 * Shared page chrome. The booking, tickets and admin pages all render this, so
 * the header only has to be corrected in one place — the previous split, where
 * page.tsx carried its own copy, is exactly how the header and the theme drifted
 * apart during the last rewrite.
 */
export function Header() {
  return (
    <div className="card card--gold">
      <span className="pill">OFFICIAL TICKETING</span>
      <div className="title">{EVENT.name}</div>
      <div className="subtitle">{EVENT.subtitle}</div>
      <div className="chips">
        <span className="chip"><b>Venue</b><span>{EVENT.venue}</span></span>
        <span className="chip"><b>Date</b><span>{EVENT.date}</span></span>
        <span className="chip"><b>Time</b><span>{EVENT.time}</span></span>
        {EVENT.mapsUrl && (
          <a className="chip" href={EVENT.mapsUrl} target="_blank" rel="noopener noreferrer">
            <b>Map</b><span>Directions ↗</span>
          </a>
        )}
      </div>
      <Link href="/tickets"
        className="mt-4 block rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 py-2.5 text-center text-[11px] font-black tracking-[0.18em] text-[#FFF2CD]">
        ALREADY BOOKED? DOWNLOAD YOUR TICKETS →
      </Link>
    </div>
  );
}

/** Choose · Seats · Pay */
export function Stepper({ active }: { active: 1 | 2 | 3 }) {
  const labels = ["Choose", "Seats", "Pay"];
  return (
    <div className="stepper">
      {labels.map((label, i) => {
        const n = i + 1;
        const cls = n === active ? "on" : n < active ? "done" : "";
        return (
          <div key={label} className="contents">
            <div className={`stp ${cls}`}>
              <div className="stp-dot">{n < active ? "✓" : n}</div>
              <span className="stp-txt">{label}</span>
            </div>
            {n < labels.length && <div className="stp-bar" />}
          </div>
        );
      })}
    </div>
  );
}
