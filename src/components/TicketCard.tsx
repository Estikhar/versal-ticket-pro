"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toJpeg } from "html-to-image";
import { EVENT, inr } from "@/lib/config";
import type { SeatRecord } from "@/lib/types";

type Row = SeatRecord & { tier: string; amount: number };

/**
 * The Pillow pass, rebuilt in DOM and rasterised in the browser.
 *
 * Server-side rendering was rejected: Google ships Inter and Playfair as
 * VARIABLE fonts, and satori/canvas silently load the Regular instance, which
 * is exactly what made generated tickets look limp. Rendering here reuses the
 * self-hosted next/font faces, and the download fires from a real user gesture
 * so Safari and Chrome stop suppressing it.
 *
 * Every colour is a literal — CSS variables do not survive rasterisation.
 */
export default function TicketCard({ row }: { row: Row }) {
  const ref = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  const payload = ["PASS", EVENT.name, `Seat: ${row.seat_id}`,
                   `Name: ${row.name}`, `Phone: ${row.phone}`,
                   ...(EVENT.mapsUrl ? [`Maps: ${EVENT.mapsUrl}`] : [])].join(" | ");

  useEffect(() => {
    // ERROR_CORRECT_L keeps the grid sparse. Higher levels add redundancy
    // modules, shrinking each module at a fixed print size — the opposite of
    // what a hand-held scan needs.
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "L", margin: 2, width: 420,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQr).catch(() => setQr(""));
  }, [payload]);

  /** Deterministic, hashed from seat + UTR: the same pass always looks the same. */
  const bars = Array.from({ length: 44 }, (_, i) => {
    const seed = [...`${row.seat_id}${row.utr_number}${i}`]
      .reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
    return { w: 1 + (seed % 4), gold: (seed >> 3) % 3 === 0, tall: (seed >> 5) % 4 !== 0 };
  });

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const data = await toJpeg(ref.current, {
        quality: 0.95, pixelRatio: 3, backgroundColor: "#0f0f0f", cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = data;
      a.download = `VIP_Pass_${row.seat_id}.jpeg`;
      a.click();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div ref={ref} className="relative w-full overflow-hidden rounded-2xl"
           style={{ background: "#0f0f0f", border: "2px solid #D4AF37" }}>
        <div className="flex">
          <div className="flex-1 p-4 sm:p-5">
            <p style={{ color: "#D4AF37", fontSize: 9, fontWeight: 900, letterSpacing: "0.24em" }}>
              OFFICIAL ADMISSION PASS
            </p>
            <p className="font-display" style={{ fontSize: 26, fontWeight: 900,
                 color: "#FFF2CD", lineHeight: 1.1, marginTop: 6 }}>
              {EVENT.name}
            </p>
            <p className="font-display" style={{ fontSize: 13, fontStyle: "italic",
                 color: "#CEB26A", marginTop: 2 }}>
              {EVENT.subtitle}
            </p>
            <p style={{ fontSize: 9, color: "#8F95A0", letterSpacing: "0.1em", marginTop: 8 }}>
              {EVENT.venue.toUpperCase()} · {EVENT.date.toUpperCase()} · {EVENT.time.toUpperCase()}
            </p>
            <div style={{ height: 1, background: "#7A6418", margin: "10px 0 12px" }} />
            <div className="grid grid-cols-2 gap-y-3">
              <Field k="ATTENDEE NAME" v={row.name} />
              <Field k="CATEGORY" v={row.tier} />
              <Field k="WHATSAPP" v={row.phone} />
              <Field k="TXN / UTR" v={row.utr_number || "—"} />
            </div>
            <div className="mt-4 inline-flex items-center rounded-full px-3 py-1.5"
                 style={{ border: "1.5px solid #D4AF37" }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: "#FCF6BA",
                             letterSpacing: "0.14em" }}>
                {row.tier} · {inr(row.amount)} PAID · VERIFIED
              </span>
            </div>
          </div>

          {/* perforation */}
          <div className="relative w-px shrink-0">
            <div className="absolute inset-y-3 left-0 w-px"
                 style={{ backgroundImage:
                   "repeating-linear-gradient(to bottom,#D4AF37 0 6px,transparent 6px 13px)" }} />
          </div>

          {/* stub */}
          <div className="w-[34%] shrink-0 p-3 text-center sm:p-4">
            <p style={{ fontSize: 8, fontWeight: 900, color: "#8F95A0",
                        letterSpacing: "0.34em" }}>SEAT</p>
            <p className="font-display" style={{ fontSize: 46, fontWeight: 900,
                 color: "#FFF2CD", lineHeight: 1.05 }}>{row.seat_id}</p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" width={104} height={104} className="mx-auto mt-2 rounded"
                   style={{ background: "#fff", padding: 5, border: "1.5px solid #D4AF37" }} />
            )}
            <div className="mt-2 flex h-5 items-end justify-center gap-[1.5px]">
              {bars.map((b, i) => (
                <span key={i} style={{ width: b.w, height: b.tall ? "100%" : "66%",
                                       background: b.gold ? "#D4AF37" : "#E2E7F0" }} />
              ))}
            </div>
            <p style={{ fontSize: 8, fontWeight: 900, color: "#D4AF37",
                        letterSpacing: "0.24em", marginTop: 6 }}>SCAN FOR ENTRY</p>
          </div>
        </div>
      </div>

      <button onClick={download} disabled={busy || !qr}
              className="btn-gold w-full disabled:opacity-50">
        {busy ? "PREPARING…" : `DOWNLOAD PASS · SEAT ${row.seat_id}`}
      </button>
      {row.checkin_time && (
        <p className="text-center text-xs text-emerald-300">
          This pass was already scanned in at {row.checkin_time}.
        </p>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p style={{ fontSize: 8, color: "#8F95A0", letterSpacing: "0.2em", fontWeight: 800 }}>{k}</p>
      <p style={{ fontSize: 13, fontWeight: 800, color: "#F6F3EC", lineHeight: 1.25 }}>{v}</p>
    </div>
  );
}
