"use client";

import { useEffect } from "react";
import { useUrgentStore } from "@/store/urgentStore";

function playBeep() {
  if (typeof Audio === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore autoplay block
  }
}

export default function UrgentToasts() {
  const alerts = useUrgentStore((s) => s.alerts);
  const dismiss = useUrgentStore((s) => s.dismiss);

  useEffect(() => {
    if (alerts.length > 0) playBeep();
  }, [alerts.length]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border-2 border-urgent bg-red-50 px-4 py-3 shadow-lg animate-pulse"
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">!</span>
              <p className="font-bold text-urgent uppercase tracking-wide text-sm">
                Ticket Urgente
              </p>
            </div>
            <button
              onClick={() => dismiss(a.id)}
              className="text-slate-400 hover:text-slate-700 text-sm"
              aria-label="Cerrar"
            >
              x
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-800 truncate">
            {a.titulo}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Ticket #{a.ticket_id.slice(0, 8)} - estado: {a.estado}
          </p>
        </div>
      ))}
    </div>
  );
}