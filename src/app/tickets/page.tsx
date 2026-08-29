"use client";

import { useState } from "react";
import Link from "next/link";
import TicketCard from "@/components/TicketCard";
import { Header } from "@/components/Chrome";
import { EVENT, inr } from "@/lib/config";
import { PENDING, BOOKED, type SeatRecord } from "@/lib/types";

type Row = SeatRecord & { tier: string; amount: number };

export default function Tickets() {
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup() {
    setError(""); setRows(null);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit number starting 6-9."); return;
    }
    setBusy(true);
    const data = await fetch(`/api/tickets?phone=${phone}`, { cache: "no-store" })
      .then((r) => r.json());
    setBusy(false);
    if (!data.ok) { setError(data.error ?? "Lookup failed."); return; }
    if (!data.rows.length) {
      setError("No booking found for that number."); return;
    }
    setRows(data.rows);
  }

  const ready = rows?.filter((r) => r.status === BOOKED) ?? [];
  const waiting = rows?.filter((r) => r.status === PENDING) ?? [];
  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <main className="page">
      <Header />
      <div className="card">
        <span className="pill">DOWNLOAD YOUR TICKET</span>
        <div className="micro" style={{ marginTop: "1.05rem" }}>
          Enter the phone number you booked with. Passes unlock after manual
          verification — within {EVENT.verifyHours} hours.
        </div>
        <div className="mt-4">
          <label className="field-label">Phone Number</label>
          <input className="field" inputMode="numeric" maxLength={10} value={phone}
                 placeholder="The number you booked with"
                 onKeyDown={(e) => e.key === "Enter" && lookup()}
                 onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
        </div>
        <button className="btn-gold mt-4 w-full" onClick={lookup} disabled={busy}>
          {busy ? "CHECKING…" : "GET MY TICKET"}
        </button>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      {rows && rows.length > 1 && (
        <div className="micro" style={{ margin: ".2rem 0 1rem" }}>
          <span className="num">{rows.length}</span> booking(s) on this number ·{" "}
          <span className="num">{ready.length}</span> verified · {inr(total)} total
        </div>
      )}

      {waiting.map((r) => (
        <div key={r.seat_id} className="notice">
          <span className="pill" style={{ background: "linear-gradient(135deg,#FFD9A0,#F0A93B)" }}>
            VERIFICATION IN PROGRESS
          </span>
          <h3>Seat {r.seat_id} is held for you.</h3>
          <p>
            We have received your transaction ID{" "}
            <b style={{ color: "#D6FFCB" }}>{r.utr_number}</b> and are confirming it
            with the bank. Nothing else is needed from you.
          </p>
        </div>
      ))}

      <div className="space-y-6">
        {ready.map((r) => <TicketCard key={r.seat_id} row={r} />)}
      </div>

      <Link href="/" className="btn-ghost mt-6 block text-center">← Back to booking</Link>
    </main>
  );
}
