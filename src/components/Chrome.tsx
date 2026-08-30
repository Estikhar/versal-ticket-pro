"use client";

import { useState } from "react";
import Link from "next/link";
import { EVENT } from "@/lib/config";

/**
 * Shared page chrome — edit HERE and every page follows.
 *
 * `/` and `/tickets` both render <Header/> and <Footer/> from this one file,
 * which is why the header only ever has to be corrected in one place.
 *
 * The banners are plain <img> rather than next/image on purpose: these are
 * artwork you drop in yourself, so their dimensions are unknown at build time
 * and next/image would need width/height or fill+sizes for each one. A missing
 * file hides its banner instead of leaving a broken-image glyph in the layout.
 */
function Banner({ src, alt, className = "" }: {
  src: string; alt: string; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)}
         className={`banner ${className}`} />
  );
}

/** Drop your artwork at public/header.png and public/footer.png. */
export const HEADER_IMG = "/header.png";
export const FOOTER_IMG = "/footer.png";

export function Header() {
  return (
    <>
      <Banner src={HEADER_IMG} alt={`${EVENT.name} — ${EVENT.subtitle}`} />
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
        <Link href="/tickets" className="dl-link">
          ALREADY BOOKED? DOWNLOAD YOUR TICKETS →
        </Link>
      </div>
    </>
  );
}

export function Footer() {
  return (
    <footer className="pagefoot">
      <Banner src={FOOTER_IMG} alt={EVENT.venue} />
      <p className="micro">
        {EVENT.venue} · {EVENT.date} · {EVENT.time}
      </p>
    </footer>
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
