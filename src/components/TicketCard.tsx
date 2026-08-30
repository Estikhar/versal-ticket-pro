"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [png, setPng] = useState<{ url: string; blob: Blob } | null>(null);
  const [note, setNote] = useState("");

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

  /**
   * Rasterise once, then hand the buyer a real image.
   *
   * The old version set an anchor's href to the data: URI straight from
   * toJpeg. Three things were wrong with that, and together they are why the
   * pass never reached anyone's gallery:
   *   - iOS Safari ignores `download` on a data: URI and just opens the image
   *     in a tab, so nothing is ever saved;
   *   - the anchor was never appended to the document, and a detached
   *     element's .click() does not fire in Safari or Firefox;
   *   - at pixelRatio 3 the base64 string runs to several MB, which some
   *     browsers drop silently.
   */
  const build = useCallback(async () => {
    if (!ref.current || png) return png;
    // html-to-image will happily rasterise before the webfonts have loaded,
    // which yields a pass set in fallback type.
    if (document.fonts?.ready) await document.fonts.ready;
    const dataUrl = await toJpeg(ref.current, {
      quality: 0.95, pixelRatio: 3, backgroundColor: "#0f0f0f", cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const made = { url: URL.createObjectURL(blob), blob };
    setPng(made);
    return made;
  }, [png]);

  useEffect(() => {
    if (qr) void build().catch(() => setNote("Could not render the pass. Reload and try again."));
  }, [qr, build]);

  useEffect(() => () => { if (png) URL.revokeObjectURL(png.url); }, [png]);

  const filename = `VIP_Pass_${row.seat_id}.jpeg`;

  /**
   * On a phone the share sheet is the only route into the photo gallery — a
   * plain download lands in Files or the Downloads folder, which is exactly
   * what "it never showed up in my gallery" means. Share gives the buyer
   * "Save Image" / "Add to Photos". Desktop falls back to a real download.
   */
  async function save() {
    setBusy(true); setNote("");
    try {
      const made = png ?? (await build());
      if (!made) return;
      const file = new File([made.blob], filename, { type: "image/jpeg" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Seat ${row.seat_id}` });
          setNote("Choose Save Image to put it in your gallery.");
          return;
        } catch (err) {
          // user dismissed the sheet — fall through to a download
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }

      const a = document.createElement("a");
      a.href = made.url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);       // detached anchors do not fire in Safari
      a.click();
      setTimeout(() => a.remove(), 4000);
      setNote("Saved to your device's Downloads.");
    } catch {
      setNote("Save failed. Long-press the pass above and choose Save Image.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {/* The finished pass, as a real image. The live DOM version cannot be
          long-pressed and saved — a browser only offers "Save Image" on an
          actual <img>, which is the most reliable route to the gallery on iOS. */}
      {png && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png.url} alt={`Pass for seat ${row.seat_id}`}
             className="w-full rounded-2xl" />
      )}

      {/* Render source. Stays mounted so it can be rasterised, but is moved
          off-screen once the image exists — display:none would give it zero
          size and html-to-image would produce a blank pass. */}
      <div ref={ref} className="relative w-full overflow-hidden rounded-2xl"
           style={{ background: "#0f0f0f", border: "2px solid #D4AF37",
                    ...(png ? { position: "absolute", left: -99999, top: 0,
                                width: 640, pointerEvents: "none" } : {}) }}>
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

      <button onClick={save} disabled={busy || !png}
              className="btn-gold w-full disabled:opacity-50">
        {!png ? "PREPARING PASS…"
          : busy ? "SAVING…"
          : `SAVE PASS · SEAT ${row.seat_id}`}
      </button>

      <p className="micro" style={{ textAlign: "center" }}>
        {note || "On a phone this opens the share sheet — choose Save Image to put the pass in your gallery. You can also long-press the pass above."}
      </p>
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
