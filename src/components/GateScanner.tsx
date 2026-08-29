"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Camera check-in. Mirrors the Streamlit gate tab.
 *
 * Uses the built-in BarcodeDetector where it exists (Chrome on Android, which
 * is what a door team actually holds). Safari and Firefox do not ship it, so
 * this degrades openly to manual entry rather than pretending to work — a
 * scanner that silently never fires is worse than no scanner.
 */
declare global {
  interface Window {
    BarcodeDetector?: new (o?: { formats: string[] }) => {
      detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
    };
  }
}

export default function GateScanner({ onSeat }: { onSeat: (seat: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const [supported, setSupported] = useState(false);

  useEffect(() => { setSupported("BarcodeDetector" in window); }, []);

  useEffect(() => {
    if (!on || !supported) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const hits = await detector.detect(videoRef.current);
            const m = /Seat:\s*([A-Q]\d{1,2})/i.exec(hits[0]?.rawValue ?? "");
            if (m) { onSeat(m[1].toUpperCase()); setOn(false); return; }
          } catch { /* frame not ready */ }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr("Camera permission denied. Use manual entry below.");
        setOn(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, supported, onSeat]);

  if (!supported) {
    return (
      <p className="rounded-xl border border-white/12 bg-white/5 p-3 text-xs text-white/50">
        This browser has no built-in QR scanner. Use Chrome on Android for camera
        check-in, or the manual seat box below — often faster at a busy door anyway.
      </p>
    );
  }

  return (
    <div>
      {on ? (
        <>
          <div className="overflow-hidden rounded-xl border border-[#D4AF37]/40">
            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
          </div>
          <button onClick={() => setOn(false)} className="btn-ghost mt-2 w-full">
            Stop camera
          </button>
        </>
      ) : (
        <button onClick={() => { setErr(""); setOn(true); }} className="btn-gold w-full">
          START CAMERA SCAN
        </button>
      )}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </div>
  );
}
