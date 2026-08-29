"use client";

import { useCallback, useEffect, useState } from "react";
import GateScanner from "@/components/GateScanner";
import { inr } from "@/lib/config";
import {
  SELLABLE_SEATS, TOTAL_SEATS, BLOCKED_SEATS, BLOCKED_MARK,
  TIER_ORDER, TIER_ROWS, seatTier, type TierId,
} from "@/lib/venue";
import { PENDING, BOOKED, type SeatRecord } from "@/lib/types";

const TABS = ["VERIFY", "PRICING", "GATE", "ROSTER", "DANGER"] as const;
type Tab = (typeof TABS)[number];

export default function Admin() {
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<SeatRecord[] | null>(null);
  const [prices, setPrices] = useState<Record<TierId, number> | null>(null);
  const [tab, setTab] = useState<Tab>("VERIFY");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [gate, setGate] = useState("");
  const [seat, setSeat] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" });
    if (res.status === 401) { setRows(null); setReady(true); return; }
    const data = await res.json();
    setRows(data.rows); setPrices(data.prices);
    setDraft(Object.fromEntries(TIER_ORDER.map((t) => [t, String(data.prices[t])])));
    setReady(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function login() {
    setErr("");
    const data = await fetch("/api/admin/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pass }),
    }).then((r) => r.json());
    if (!data.ok) { setErr(data.error ?? "Login failed."); return; }
    setPass(""); await load();
  }

  async function act(action: string, target?: string) {
    const data = await fetch("/api/admin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, seat: target }),
    }).then((r) => r.json());
    if (action === "checkin") setGate(data.message ?? "");
    await load();
  }

  async function savePrices() {
    setSaved("");
    const payload = Object.fromEntries(TIER_ORDER.map((t) => [t, Number(draft[t])]));
    const data = await fetch("/api/admin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prices", prices: payload }),
    }).then((r) => r.json());
    setSaved(data.ok
      ? TIER_ORDER.map((t) => `${t} ${inr(data.prices[t])}`).join(" · ")
      : (data.message ?? "Failed."));
    if (data.ok) await load();
  }

  if (!ready) return <main className="page text-center text-white/40">Loading…</main>;

  if (!rows || !prices) {
    return (
      <main className="page" style={{ maxWidth: 460 }}>
        <div className="card">
          <span className="pill">RESTRICTED</span>
          <div className="micro" style={{ marginTop: "1.05rem" }}>Organiser access only.</div>
          <div className="mt-4">
            <label className="field-label">Admin password</label>
            <input className="field" type="password" value={pass}
                   onKeyDown={(e) => e.key === "Enter" && login()}
                   onChange={(e) => setPass(e.target.value)} />
          </div>
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
          <button className="btn-gold mt-4 w-full" onClick={login}>UNLOCK</button>
          <p className="micro mt-4">
            Sets an httpOnly session cookie for 8 hours. The password is sent once,
            at login — never on later requests.
          </p>
        </div>
      </main>
    );
  }

  const pending = rows.filter((r) => r.status === PENDING);
  const isBlock = (r: SeatRecord) =>
    r.name.trim() === BLOCKED_MARK || BLOCKED_SEATS.has(r.seat_id);
  const sold = rows.filter((r) => r.status === BOOKED && !isBlock(r));
  const revenue = sold.reduce((s, r) => s + prices[seatTier(r.seat_id)], 0);
  const admitted = rows.filter((r) => r.checkin_time.trim()).length;

  return (
    <main className="page">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat k="Sold" v={String(sold.length)} />
        <Stat k="Pending" v={String(pending.length)} />
        <Stat k="Open" v={String(Math.max(SELLABLE_SEATS - sold.length - pending.length, 0))} />
        <Stat k="Revenue" v={inr(revenue)} />
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "VERIFY" && (
        <div className="card">
          {!pending.length && <p className="text-sm text-white/50">Nothing awaiting verification.</p>}
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.seat_id} className="rounded-xl border border-white/10 p-3">
                <p className="font-bold">
                  {r.seat_id} · {seatTier(r.seat_id)} · {inr(prices[seatTier(r.seat_id)])}
                </p>
                <p className="text-sm text-white/60">
                  {r.name} · {r.phone} · UTR {r.utr_number}
                </p>
                <p className="micro mt-1">Submitted {r.booked_at}</p>
                <p className="micro mt-1">
                  Confirm this exact amount landed against this UTR before approving.
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-gold flex-1 !py-2.5 text-xs"
                          onClick={() => act("approve", r.seat_id)}>APPROVE</button>
                  <button className="btn-danger flex-1 text-xs"
                          onClick={() => act("reject", r.seat_id)}>REJECT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "PRICING" && (
        <div className="card">
          <p className="micro mb-4">
            Applies to new bookings. The roster prices each sale from its own row,
            so a change here never rewrites what someone already paid.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TIER_ORDER.map((t) => (
              <label key={t} className="block">
                <span className="field-label">{t} (₹)</span>
                <input className="field" inputMode="numeric" value={draft[t] ?? ""}
                       onChange={(e) => setDraft({ ...draft, [t]: e.target.value.replace(/\D/g, "") })} />
                <span className="micro">{TIER_ROWS[t]}</span>
              </label>
            ))}
          </div>
          <button className="btn-gold mt-4 w-full" onClick={savePrices}>SAVE PRICING</button>
          {saved && <p className="mt-2 text-xs text-emerald-300">{saved}</p>}
        </div>
      )}

      {tab === "GATE" && (
        <div className="card">
          <p className="micro mb-3">Checked in so far: <span className="num">{admitted}</span></p>
          <GateScanner onSeat={(s) => act("checkin", s)} />
          <div className="mt-4">
            <label className="field-label">Manual check-in — seat number</label>
            <input className="field" value={seat} maxLength={4} placeholder="e.g. C12"
                   onKeyDown={(e) => e.key === "Enter" && act("checkin", seat)}
                   onChange={(e) => setSeat(e.target.value.toUpperCase())} />
          </div>
          <button className="btn-gold mt-3 w-full" onClick={() => act("checkin", seat)}>
            CHECK IN
          </button>
          {gate && (
            <p className={`mt-3 text-sm font-bold ${
              gate.startsWith("ADMIT") ? "text-emerald-300" : "text-red-300"}`}>
              {gate}
            </p>
          )}
        </div>
      )}

      {tab === "ROSTER" && (
        <div className="card">
          {!sold.length && <p className="text-sm text-white/50">No confirmed attendees yet.</p>}
          {sold.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <tr>
                    <th className="py-2">Seat</th><th>Cat</th><th>Paid</th><th>Name</th>
                    <th>Phone</th><th>UTR</th><th>Booked</th><th>In</th>
                  </tr>
                </thead>
                <tbody>
                  {sold.map((r) => (
                    <tr key={r.seat_id} className="border-t border-white/10">
                      <td className="py-2 font-bold">{r.seat_id}</td>
                      <td>{seatTier(r.seat_id)}</td>
                      <td>{inr(prices[seatTier(r.seat_id)])}</td>
                      <td>{r.name}</td><td>{r.phone}</td><td>{r.utr_number}</td>
                      <td className="whitespace-nowrap">{r.booked_at}</td>
                      <td>{r.checkin_time ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "DANGER" && (
        <div className="card" style={{ borderColor: "rgba(239,68,68,.4)" }}>
          <p className="text-sm text-white/70">
            Reset wipes every booking and re-seeds {TOTAL_SEATS} seats, re-applying
            {" "}{BLOCKED_SEATS.size} house blocks ({SELLABLE_SEATS} sellable).
            Not reversible.
          </p>
          <label className="micro mt-4 flex items-center gap-2">
            <input type="checkbox" checked={confirmReset}
                   onChange={(e) => setConfirmReset(e.target.checked)} />
            I understand this deletes all bookings
          </label>
          <button className="btn-danger mt-3 w-full" disabled={!confirmReset}
                  style={{ opacity: confirmReset ? 1 : 0.4 }}
                  onClick={() => act("reset")}>
            RESET DATABASE
          </button>
          <button className="btn-ghost mt-3 w-full"
                  onClick={async () => {
                    await fetch("/api/admin/login", { method: "DELETE" });
                    location.reload();
                  }}>
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="card" style={{ padding: "1rem", marginBottom: 0 }}>
      <p className="eyebrow">{k}</p>
      <p className="mt-1 text-xl font-black" style={{ color: "#E8CC6B" }}>{v}</p>
    </div>
  );
}
