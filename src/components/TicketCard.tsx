"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toJpeg } from "html-to-image";
import { EVENT, inr } from "@/lib/config";
import type { SeatRecord } from "@/lib/types";

type Row = SeatRecord & { tier: string; amount: number };

/** Fixed design canvas. The pass is ALWAYS rasterised at this size. */
const W = 1200;
const H = 450;
const STUB_X = 812;

const GOLD = "#D4AF37";
const GOLD_HI = "#FFF2CD";
const INK = "#0f0f0f";
const MUTED = "#8F95A0";

export default function TicketCard({ row }: { row: Row }) {
  const ref = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const [png, setPng] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const payload = ["PASS", EVENT.name, `Seat: ${row.seat_id}`,
                   `Name: ${row.name}`, `Phone: ${row.phone}`,
                   ...(EVENT.mapsUrl ? [`Maps: ${EVENT.mapsUrl}`] : [])].join(" | ");
  const filename = `VIP_Pass_${row.seat_id}.jpeg`;
  const ref6 = hash(`${row.seat_id}${row.utr_number}${row.phone}`).slice(0, 12).toUpperCase();

  useEffect(() => {
    // ERROR_CORRECT_L keeps the module grid sparse; higher levels add
    // redundancy modules and shrink each one at a fixed print size, which is
    // the opposite of what a hand-held scan needs.
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "L", margin: 1, width: 480,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQr).catch(() => setQr(""));
  }, [payload]);

  const build = useCallback(async () => {
    const node = ref.current;
    if (!node) return null;

    // Two waits, both learned the hard way. Without the font wait the pass is
    // set in fallback type; without the image wait html-to-image snapshots the
    // QR before it has decoded and the plate comes out PURE WHITE — a pass the
    // gate scanner cannot read at all.
    if (document.fonts?.ready) await document.fonts.ready;
    const imgs = Array.from(
      node.querySelectorAll("img"),
    ) as HTMLImageElement[];
    await Promise.all(imgs.map(async (im) => {
      if (im.complete && im.naturalWidth > 0) return;
      try { await im.decode(); } catch { /* leave it; better than hanging */ }
    }));

    const dataUrl = await toJpeg(node, {
      quality: 0.96, pixelRatio: 2, width: W, height: H,
      backgroundColor: INK, cacheBust: true,
    });
    const blob = await (await fetch(dataUrl)).blob();
    const made = { url: URL.createObjectURL(blob), blob };
    setPng(made);
    return made;
  }, []);

  useEffect(() => {
    if (!qr) return;
    void build().catch(() => setNote("Could not render the pass. Reload and try again."));
  }, [qr, build]);

  useEffect(() => () => { if (png) URL.revokeObjectURL(png.url); }, [png]);

  /**
   * On a phone the share sheet is the only route into the photo gallery — a
   * plain download lands in Files or Downloads, which is what "it never showed
   * up in my gallery" means. Desktop falls back to a real download.
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
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      const a = document.createElement("a");
      a.href = made.url; a.download = filename; a.style.display = "none";
      document.body.appendChild(a);      // detached anchors do not fire in Safari
      a.click();
      setTimeout(() => a.remove(), 4000);
      setNote("Saved to your device's Downloads.");
    } catch {
      setNote("Save failed. Long-press the pass and choose Save Image.");
    } finally { setBusy(false); }
  }

  const bars = Array.from({ length: 46 }, (_, i) => {
    const s = hashNum(`${row.seat_id}${row.utr_number}${i}`);
    return { w: 2 + (s % 5), gold: (s >> 3) % 3 === 0, tall: (s >> 5) % 4 !== 0 };
  });

  return (
    <div className="space-y-3">
      {png ? (
        // The finished pass as a real image: only an <img> offers "Save Image"
        // on long-press, which is the most reliable route into the gallery.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png.url} alt={`Pass for seat ${row.seat_id}`}
             className="w-full rounded-2xl" />
      ) : (
        <div className="ticket-skeleton">Pressing your pass…</div>
      )}

      {/* Render source — fixed size, always off-screen. Rasterising the
          on-screen card instead produced a tall 1.39:1 card on a phone rather
          than a 2.67:1 boarding pass. display:none would give it zero size and
          html-to-image would emit a blank image, so it is moved, not hidden. */}
      <div style={{ position: "absolute", left: -99999, top: 0,
                    width: W, height: H, pointerEvents: "none" }} aria-hidden>
        <div ref={ref} style={{
          position: "relative", width: W, height: H, overflow: "hidden",
          background: INK, borderRadius: 20, border: `2px solid ${GOLD}`,
          fontFamily: "var(--font-inter), Inter, sans-serif",
        }}>
          <div style={{ position: "absolute", inset: 0, background:
            "radial-gradient(620px 340px at 6% -18%, rgba(212,175,55,.20), transparent 62%),"
            + "radial-gradient(420px 260px at 96% 118%, rgba(212,175,55,.13), transparent 60%)" }} />

          {[[24, 24, 1, 1], [W - 24, 24, -1, 1],
            [24, H - 24, 1, -1], [W - 24, H - 24, -1, -1]].map(([x, y, dx, dy], i) => (
            <span key={i} style={{ position: "absolute", left: x, top: y }}>
              <span style={{ position: "absolute", width: 30 * dx, height: 2,
                             background: GOLD, transformOrigin: "left" }} />
              <span style={{ position: "absolute", width: 2, height: 30 * dy,
                             background: GOLD }} />
            </span>
          ))}

          {/* ---------------- left panel ---------------- */}
          <div style={{ position: "absolute", left: 44, top: 34, width: STUB_X - 88 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: ".3em",
                        color: GOLD }}>OFFICIAL ADMISSION PASS</p>
            <p className="font-display" style={{ margin: "10px 0 0", fontSize: 54,
                 fontWeight: 900, lineHeight: 1.02, color: GOLD_HI,
                 textShadow: "0 0 26px rgba(212,175,55,.45)" }}>{EVENT.name}</p>
            <p className="font-display" style={{ margin: "4px 0 0", fontSize: 21,
                 fontStyle: "italic", color: "#CEB26A" }}>{EVENT.subtitle}</p>
            <p style={{ margin: "12px 0 0", fontSize: 11.5, letterSpacing: ".12em",
                        color: MUTED, whiteSpace: "nowrap" }}>
              {EVENT.venue.toUpperCase()} · {EVENT.date.toUpperCase()} · {EVENT.time.toUpperCase()}
            </p>
            <div style={{ height: 1, background: "#7A6418", margin: "14px 0 16px" }} />
            <div style={{ display: "flex", gap: 40 }}>
              <Field k="ATTENDEE NAME" v={row.name} w={340} />
              <Field k="CATEGORY" v={row.tier} w={200} />
            </div>
            <div style={{ display: "flex", gap: 40, marginTop: 18 }}>
              <Field k="WHATSAPP" v={row.phone} w={340} />
              <Field k="TXN / UTR" v={row.utr_number || "—"} w={200} />
            </div>
          </div>

          <div style={{ position: "absolute", left: 44, bottom: 34,
                        display: "flex", alignItems: "center", gap: 22 }}>
            <span style={{ display: "inline-block", padding: "11px 24px", borderRadius: 999,
                           border: `2px solid ${GOLD}`, fontSize: 13, fontWeight: 900,
                           letterSpacing: ".14em", color: GOLD_HI, whiteSpace: "nowrap" }}>
              {row.tier} · {inr(row.amount)} PAID · VERIFIED
            </span>
            <span style={{ fontSize: 10.5, letterSpacing: ".22em", color: MUTED }}>
              REF {ref6}
            </span>
          </div>

          {/* ---------------- perforation ---------------- */}
          <div style={{ position: "absolute", left: STUB_X, top: 34, bottom: 34, width: 2,
            backgroundImage: `repeating-linear-gradient(to bottom, ${GOLD} 0 9px, transparent 9px 19px)` }} />
          {[-16, H - 16].map((t, i) => (
            <span key={i} style={{ position: "absolute", left: STUB_X - 15, top: t,
              width: 32, height: 32, borderRadius: "50%", background: INK,
              border: `2px solid ${GOLD}` }} />
          ))}

          {/* ---------------- stub ---------------- */}
          <div style={{ position: "absolute", left: STUB_X + 2, right: 0, top: 0, bottom: 0,
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: 6, padding: "26px 18px" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: ".38em",
                        color: MUTED }}>SEAT</p>
            <p className="font-display" style={{ margin: 0, fontSize: 74, fontWeight: 900,
                 lineHeight: 1, color: GOLD_HI,
                 textShadow: "0 0 30px rgba(212,175,55,.75)" }}>{row.seat_id}</p>
            <div style={{ marginTop: 6, padding: 8, background: "#fff", borderRadius: 12,
                          border: `2px solid ${GOLD}`, lineHeight: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="" width={132} height={132} />}
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "flex-end",
                          height: 26, gap: 2 }}>
              {bars.map((b, i) => (
                <span key={i} style={{ width: b.w, height: b.tall ? 26 : 17,
                                       background: b.gold ? GOLD : "#E2E7F0" }} />
              ))}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 10.5, fontWeight: 900,
                        letterSpacing: ".26em", color: GOLD }}>SCAN FOR ENTRY</p>
            <p style={{ margin: 0, fontSize: 8.5, letterSpacing: ".18em", color: "#6C7280" }}>
              {row.seat_id} · NON-TRANSFERABLE
            </p>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={busy || !png}
              className="btn-gold w-full disabled:opacity-50">
        {!png ? "PREPARING PASS…" : busy ? "SAVING…" : `SAVE PASS · SEAT ${row.seat_id}`}
      </button>
      <p className="micro" style={{ textAlign: "center" }}>
        {note || "On a phone this opens the share sheet — choose Save Image to put the pass in your gallery. You can also long-press the pass above."}
      </p>
      {row.checkin_time && (
        <p className="text-center text-xs text-emerald-300">
          Already scanned in at {row.checkin_time}.
        </p>
      )}
    </div>
  );
}

function Field({ k, v, w }: { k: string; v: string; w: number }) {
  return (
    <div style={{ width: w, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 9.5, letterSpacing: ".22em", fontWeight: 800,
                  color: MUTED }}>{k}</p>
      <p style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 800, color: "#F6F3EC",
                  lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis" }}>{v}</p>
    </div>
  );
}

/** Deterministic, so the same pass always rasterises identically. */
function hashNum(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
}
function hash(s: string): string {
  let a = 0x811c9dc5;
  for (const c of s) { a ^= c.charCodeAt(0); a = Math.imul(a, 0x01000193) >>> 0; }
  return a.toString(16).padStart(8, "0") + hashNum(s).toString(16).padStart(4, "0");
}
