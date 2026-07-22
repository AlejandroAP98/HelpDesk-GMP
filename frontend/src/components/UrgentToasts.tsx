"use client";

import { useEffect } from "react";
import { useUrgentStore, type AlertKind } from "@/store/urgentStore";

function playBeep(frequency = 880) {
  if (typeof Audio === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
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

function playAssignedBeep() {
  playBeep(660);
}

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: { id: string; kind: AlertKind; ticket_id: string; titulo?: string; estado?: string; estado_anterior?: string; estado_nuevo?: string; comentario_usuario?: string };
  onDismiss: () => void;
}) {
  if (alert.kind === "assigned") {
    return (
      <div
        className="rounded-2xl bg-white border border-blue-100 p-4 shadow-elevated animate-slide-in-right relative overflow-hidden cursor-pointer"
        role="alert"
        onClick={() => {
          window.location.href = `/tickets/${alert.ticket_id}`;
        }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-brandCustom rounded-l-2xl" />
        <div className="flex items-start justify-between gap-2 pl-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-brandCustom" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="font-bold text-brandCustom uppercase tracking-wider text-[11px]">
              Te asignaron un ticket
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-300 hover:text-gray-500 hover:bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
            aria-label="Cerrar"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 pl-3">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {alert.titulo}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-brandCustom font-bold uppercase tracking-wider border border-blue-100">
              #{alert.ticket_id.slice(0, 8)}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              {alert.estado}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (alert.kind === "state_changed") {
    return (
      <div
        className="rounded-2xl bg-white border border-brandCustom p-4 shadow-elevated animate-slide-in-right relative overflow-hidden cursor-pointer"
        role="alert"
        onClick={() => {
          window.location.href = `/tickets/${alert.ticket_id}`;
        }}
      >
        <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl ${
          alert.estado_nuevo === "asignado" ? "bg-violetCustom" :
          alert.estado_nuevo === "resuelto" ? "bg-greenCustom" :
          alert.estado_nuevo === "en_progreso" ? "bg-yellowCustom" :
          alert.estado_nuevo === "cerrado" ? "bg-grayCustom" :
          "bg-brandCustom" 
        }`} />
        <div className="flex items-start justify-between gap-2 pl-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="font-bold text-emerald-700 uppercase tracking-wider text-[11px]">
              Estado del ticket
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-300 hover:text-gray-500 hover:bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
            aria-label="Cerrar"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 pl-3">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {alert.titulo}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-emerald-50 text-emerald-700 font-bold uppercase tracking-wider border border-emerald-100">
              #{alert.ticket_id.slice(0, 8)}
            </span>
            {alert.estado_anterior && alert.estado_nuevo && (
              <span className="text-[10px] text-gray-500 font-semibold">
                {alert.estado_anterior} <span className="text-emerald-500">→</span> {alert.estado_nuevo}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (alert.kind === "commented") {
    return (
      <div
        className="rounded-2xl bg-white border border-orange-200 p-4 shadow-elevated animate-slide-in-right relative overflow-hidden cursor-pointer"
        role="alert"
        onClick={() => {
          window.location.href = `/tickets/${alert.ticket_id}`;
        }}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-accentCustom rounded-l-2xl" />
        <div className="flex items-start justify-between gap-2 pl-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-message" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M8 9h8m-8 4h6m4-9a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/></svg>
            </div>
            <p className="font-bold text-accentCustom uppercase tracking-wider text-[11px]">
              Nuevo comentario
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-300 hover:text-gray-500 hover:bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
            aria-label="Cerrar"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 pl-3">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {alert.comentario_usuario} comentó en el ticket
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-accentCustom text-white font-bold uppercase tracking-wider border border-accentCustom">
              #{alert.ticket_id.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl bg-white border border-red-100 p-4 shadow-elevated animate-slide-in-right relative overflow-hidden"
      role="alert"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-redCustom rounded-l-2xl" />
      <div className="flex items-start justify-between gap-2 pl-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-bold text-red-600 uppercase tracking-wider text-[11px]">
            Ticket Urgente
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 hover:bg-gray-100 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all"
          aria-label="Cerrar"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-3 pl-3">
        <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
          {alert.titulo}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] bg-red-50 text-red-600 font-bold uppercase tracking-wider border border-red-100">
            #{alert.ticket_id.slice(0, 8)}
          </span>
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            {alert.estado}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function UrgentToasts() {
  const alerts = useUrgentStore((s) => s.alerts);
  const dismiss = useUrgentStore((s) => s.dismiss);

  useEffect(() => {
    if (alerts.length === 0) return;
    const latest = alerts[0];
    if (latest.kind === "assigned") {
      playAssignedBeep();
    } else if (latest.kind === "state_changed") {
      playBeep(770);
    } else if (latest.kind === "commented") {
      playBeep(520);
    } else {
      playBeep();
    }
  }, [alerts]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-72 sm:w-80 lg:w-96 sm:top-6 sm:right-6">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
      ))}
    </div>
  );
}
