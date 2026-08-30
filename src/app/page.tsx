"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SeatMap from "@/components/SeatMap";
import { Header, Stepper } from "@/components/Chrome";
import { EVENT, inr } from "@/lib/config";
import {
  DEFAULT_PRICES, SELLABLE_SEATS, seatTier, SEAT_RANK, type TierId,
} from "@/lib/venue";
import { AVAILABLE, type SeatStatus } from "@/lib/types";

type Step = 1 | 2 | 3;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [statuses, setStatuses] = useState<Record<string, SeatStatus>>({});
  const [prices, setPrices] = useState<Record<TierId, number>>(DEFAULT_PRICES);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [qrMissing, setQrMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [done, setDone] = useState<{ seats: string[]; total: number; phone: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/seats", { cache: "no-store" });
      const r = await res.json();
      if (!res.ok || !r.statuses) {
        throw new Error(r.error ?? `Seat data unavailable (HTTP ${res.status}).`);
      }
      setStatuses(r.statuses);
      if (r.prices) setPrices(r.prices);
      setLoadError("");
    } catch (e) {
      // An empty map must never be mistaken for a sold-out hall — that is
      // exactly what disabled the booking button with no explanation.
      setLoadError(e instanceof Error ? e.message : "Could not load the seat map.");
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  /** Seats listed in physical order, not tap order — reads like a real ticket. */
  const chosen = useMemo(
    () => [...picked].sort((a, b) => (SEAT_RANK[a] ?? 0) - (SEAT_RANK[b] ?? 0)),
    [picked],
  );
  const total = useMemo(
    () => chosen.reduce((s, id) => s + prices[seatTier(id)], 0),
    [chosen, prices],
  );
  const open = useMemo(
    () => Object.values(statuses).filter((s) => s === AVAILABLE).length,
    [statuses],
  );

  function toggle(seat: string) {
    setErrors([]);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(seat)) next.delete(seat); else next.add(seat);
      return next;
    });
  }

  async function submit() {
    setBusy(true); setErrors([]);
    const data = await fetch("/api/book", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        seats: chosen, 
        name: form.name, 
        phone: form.phone, 
        utr: "PND" + Date.now().toString().slice(-9) 
      }),
    }).then((r) => r.json());
    setBusy(false);
    if (!data.ok) {
      setErrors(data.errors ?? [data.message ?? "Booking failed."]);
      await refresh();
      return;
    }
    setDone({ seats: chosen, total, phone: form.phone });
    setPicked(new Set());
  }

  // ------------------------------------------------------------------ done
  if (done) {
    return (
      <main className="page">
        <Header />
        <div className="notice">
          <span className="pill" style={{ backgroundImage: "linear-gradient(135deg,#FFD9A0,#F0A93B)" }}>
            PAYMENT UNDER VERIFICATION
          </span>
          <h3>{done.seats.length} seat{done.seats.length > 1 ? "s" : ""} held · {inr(done.total)}</h3>
          <div className="chips" style={{ marginBottom: ".9rem" }}>
            {done.seats.map((s) => (
              <span key={s} className="chip">
                <b>{s}</b><span>{seatTier(s)} · {inr(prices[seatTier(s)])}</span>
              </span>
            ))}
          </div>
          <p>
            Each transaction is verified manually — within <b>{EVENT.verifyHours} hours</b>.
            <br /><br />
            <b>No tickets are issued yet.</b> Once confirmed, open{" "}
            <b>Download Ticket</b> and enter{" "}
            <b style={{ color: "#FFF2CD" }}>{done.phone}</b> — every pass booked on
            that number appears together. Keep your UPI receipt until you are inside.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button className="btn-gold" onClick={() => { setDone(null); setStep(2); void refresh(); }}>
            BOOK MORE SEATS
          </button>
          <Link href="/tickets" className="btn-ghost text-center">GO TO MY TICKETS</Link>
        </div>
      </main>
    );
  }

  // --------------------------------------------------------------- step 1
  if (step === 1) {
    return (
      <main className="page">
        <Header />
        <Stepper active={1} />
        <div className="card card--gold">
          <span className="pill">HOW IT WORKS</span>
          <div className="micro" style={{ marginTop: "1rem", lineHeight: 2 }}>
            <b style={{ color: "#FFF2CD" }}>1.</b> Pick your seats — the total updates live.<br />
            <b style={{ color: "#FFF2CD" }}>2.</b> Pay the exact amount by UPI, then enter your
            {" "}12-digit transaction ID.<br />
            <b style={{ color: "#FFF2CD" }}>3.</b> We verify within {EVENT.verifyHours} hours and
            your passes unlock under <b style={{ color: "#FFF2CD" }}>Download Ticket</b>.
          </div>
        </div>

        {loadError && (
          <div className="notice" style={{ borderColor: "rgba(239,68,68,.5)" }}>
            <h3 style={{ color: "#FCA5A5" }}>Could not load the seat map</h3>
            <p>{loadError}</p>
            <button className="btn-ghost mt-4 w-full"
                    onClick={() => { setLoaded(false); void refresh(); }}>
              RETRY
            </button>
          </div>
        )}

        <button className="btn-gold w-full" style={{ minHeight: 76, fontSize: "1.05rem" }}
                disabled={!loaded || Boolean(loadError) || open === 0}
                onClick={() => setStep(2)}>
          {!loaded ? "LOADING SEATS…"
            : loadError ? "UNAVAILABLE"
            : open === 0 ? "SOLD OUT"
            : "START BOOKING"}
        </button>
      </main>
    );
  }

  // --------------------------------------------------------------- step 2
  if (step === 2) {
    return (
      <>
        <main className="page">
          <Header />
          <Stepper active={2} />
          <div className="card">
            <span className="pill">CHOOSE YOUR SEATS</span>
            <div className="micro" style={{ marginTop: "1rem" }}>
              Tap any open seat. Crossed seats are unavailable. Drag the map
              sideways to reach the full width of the hall.
            </div>
          </div>

          <div className="card" style={{ paddingLeft: ".75rem", paddingRight: ".75rem" }}>
            <SeatMap statuses={statuses} selected={picked} prices={prices} onToggle={toggle} />
          </div>

          <button className="btn-ghost w-full" onClick={() => setStep(1)}>Back</button>
        </main>

        {/* sticky bottom action bar */}
        <div className="actionbar">
          <div className="actionbar__inner">
            <div className="actionbar__row">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  {picked.size
                    ? `${picked.size} seat${picked.size > 1 ? "s" : ""} selected`
                    : loaded ? `${open} of ${SELLABLE_SEATS} available` : "Loading seats…"}
                </p>
                <p className="truncate text-sm font-bold">
                  {picked.size ? chosen.join(", ") : "Tap a seat to begin"}
                </p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Total</p>
                <p className="total">{inr(total)}</p>
              </div>
            </div>
            <button className="btn-gold w-full" disabled={!picked.size}
                    onClick={() => setStep(3)}>
              PROCEED TO PAY
            </button>
          </div>
        </div>
      </>
    );
  }

  // --------------------------------------------------------------- step 3
  return (
    <main className="page">
      <Header />
      <Stepper active={3} />

      <div className="receipt">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <span className="eyebrow">Your seats</span>
            <div className="font-display font-black"
                 style={{ fontSize: chosen.length > 4 ? "1.35rem" : "2rem", lineHeight: 1.15,
                          color: "#FFF2CD" }}>
              {chosen.join(", ")}
            </div>
          </div>
          <div>
            <span className="eyebrow">Total payable</span>
            <div className="total" style={{ fontSize: "2rem" }}>{inr(total)}</div>
          </div>
        </div>
      </div>

      <div className="card card--gold">
        <span className="pill">STEP 1 · PAY BY UPI</span>
        <div className="micro" style={{ marginTop: "1rem" }}>
          Pay <b style={{ color: "#FFF2CD" }}>{inr(total)}</b> exactly — a different
          amount delays verification.
        </div>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* A missing QR used to render as a broken-image glyph inside a huge
              empty card, which looks like the payment step is broken. */}
          {qrMissing ? (
            <div className="qr-missing">
              <b>UPI QR not set up</b>
              <span>Pay to the UPI ID shown, or ask the organiser for the QR.</span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/upi_qr.png" alt="UPI QR" width={230} height={230}
                 onError={() => setQrMissing(true)}
                 className="shrink-0 rounded-2xl bg-white p-2" />
          )}
          <div className="flex-1">
            {EVENT.upiId && (
              <>
                <p className="eyebrow">UPI ID</p>
                <p className="mt-1 break-all font-mono text-sm" style={{ color: "#FFF2CD" }}>
                  {EVENT.upiId}
                </p>
              </>
            )}
            <p className="micro mt-3">
              After paying, copy the <b style={{ color: "#FFF2CD" }}>12-digit UTR /
              Transaction ID</b> from your UPI receipt. Keep the receipt until you
              are inside the venue.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <span className="pill">STEP 2 · CONFIRM PAYMENT</span>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="field-label">Full Name</span>
            <input className="field" maxLength={60} value={form.name}
                   placeholder="Exactly as printed on your ID"
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">Phone Number</span>
            <input className="field" inputMode="numeric" maxLength={10} value={form.phone}
                   placeholder="10 digits, starting 6-9"
                   onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
          </label>
        </div>

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {errors.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}

        <button className="btn-gold mt-5 w-full" disabled={busy} onClick={submit}>
          {busy ? "SUBMITTING…" : "SUBMIT FOR VERIFICATION"}
        </button>
        <button className="btn-ghost mt-3 w-full" onClick={() => setStep(2)}>
          Change seats
        </button>
      </div>

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {errors.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}

        <button className="btn-gold mt-5 w-full" disabled={busy} onClick={submit}>
          {busy ? "SUBMITTING…" : "SUBMIT FOR VERIFICATION"}
        </button>
        <button className="btn-ghost mt-3 w-full" onClick={() => setStep(2)}>
          Change seats
        </button>
      </div>
    </main>
  );
}
