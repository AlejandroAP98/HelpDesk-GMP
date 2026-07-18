"use client";

import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import type { TareaPendiente } from "@/lib/endpoints";
import { tareaApi } from "@/lib/endpoints";
import { extractApiError } from "@/lib/errors";

interface TareaCardProps {
  tarea: TareaPendiente;
  onToggle: (id: string, completada: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<TareaPendiente>) => void;
  style?: React.CSSProperties;
}

const SWIPE_DISTANCE = 170;
const SWIPE_VELOCITY = 0.6;
const COMMIT_RATIO = 0.45;
const MAX_RATIO = 0.7;
const HORIZONTAL_LOCK = 10;

function tiempoRelativo(fecha: string): string {
  const ahora = Date.now();
  const entonces = new Date(fecha).getTime();
  const diff = ahora - entonces;
  const segs = Math.floor(diff / 1000);
  if (segs < 60) return "ahora";
  const mins = Math.floor(segs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 7) return `${dias}d`;
  const semanas = Math.floor(dias / 7);
  return `${semanas}sem`;
}

export default function TareaCard({ tarea, onToggle, onDelete, onUpdate, style }: TareaCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(tarea.texto);
  const [justCompleted, setJustCompleted] = useState(false);
  const [exiting, setExiting] = useState<null | "delete">(null);
  const [flash, setFlash] = useState<null | "complete" | "uncomplete">(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const offsetX = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startT = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false);
  const didMove = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => (n + 1) % 1000000), []);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editing, editText.length]);

  const cancelSwipe = () => {
    swiping.current = false;
    locked.current = false;
    didMove.current = false;
    if (pointerIdRef.current !== null && cardRef.current) {
      try {
        cardRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {
        /* noop */
      }
    }
    pointerIdRef.current = null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editing || exiting) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startT.current = performance.now();
    swiping.current = true;
    locked.current = false;
    didMove.current = false;
    pointerIdRef.current = e.pointerId;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!swiping.current || editing) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!locked.current) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        cancelSwipe();
        return;
      }
      locked.current = true;
      didMove.current = true;
      if (cardRef.current && pointerIdRef.current !== null) {
        try {
          cardRef.current.setPointerCapture(pointerIdRef.current);
        } catch {
          /* noop */
        }
      }
    }

    const width = cardRef.current?.offsetWidth ?? 320;
    const maxOffset = width * MAX_RATIO;
    const clamped = Math.max(-maxOffset, Math.min(maxOffset, dx));
    offsetX.current = clamped;
    rerender();
  };

  const finishSwipe = async (dir: "complete" | "uncomplete" | "delete") => {
    if (dir === "delete") {
      setExiting("delete");
      try {
        await tareaApi.eliminar(tarea.id);
        onDelete(tarea.id);
      } catch (err) {
        setExiting(null);
        setError(extractApiError(err));
      }
      return;
    }
    setFlash(dir);
    setTimeout(() => setFlash(null), 500);
    try {
      const nuevo = dir === "complete";
      await tareaApi.actualizar(tarea.id, { completada: nuevo });
      onToggle(tarea.id, nuevo);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!swiping.current) return;
    const wasLocked = locked.current;
    const dx = offsetX.current;
    const dt = Math.max(1, performance.now() - startT.current);
    const width = cardRef.current?.offsetWidth ?? 320;
    const velocity = Math.abs(dx) / dt;
    const ratio = Math.abs(dx) / width;

    if (wasLocked) {
      try {
        if (pointerIdRef.current !== null) {
          cardRef.current?.releasePointerCapture(pointerIdRef.current);
        }
      } catch {
        /* noop */
      }
    }
    cancelSwipe();
    offsetX.current = 0;
    rerender();

    if (!wasLocked) return;

    const passed =
      Math.abs(dx) >= SWIPE_DISTANCE ||
      (velocity >= SWIPE_VELOCITY && Math.abs(dx) >= 60) ||
      ratio >= COMMIT_RATIO;

    if (!passed) return;

    if (dx > 0) {
      void finishSwipe(tarea.completada ? "uncomplete" : "complete");
    } else {
      void finishSwipe("delete");
    }
  };

  const handleToggle = async () => {
    if (didMove.current) {
      didMove.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nuevo = !tarea.completada;
      await tareaApi.actualizar(tarea.id, { completada: nuevo });
      if (nuevo) {
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 600);
      }
      onToggle(tarea.id, nuevo);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (didMove.current) {
      didMove.current = false;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await tareaApi.eliminar(tarea.id);
      onDelete(tarea.id);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await tareaApi.actualizar(tarea.id, { texto: editText.trim() });
      onUpdate(tarea.id, { texto: editText.trim() });
      setEditing(false);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(tarea.texto);
    setEditing(false);
    setError(null);
  };

  const dx = exiting ? -1000 : offsetX.current;
  const cardWidth = cardRef.current?.offsetWidth ?? 320;
  const revealR = Math.max(0, dx);
  const revealL = Math.max(0, -dx);
  const revealRatioR = Math.min(1, revealR / (cardWidth * 0.4));
  const revealRatioL = Math.min(1, revealL / (cardWidth * 0.4));
  const readyR = revealR >= SWIPE_DISTANCE;
  const readyL = revealL >= SWIPE_DISTANCE;

  const cardTransition = exiting
    ? "transform 550ms cubic-bezier(0.4, 0, 0.2, 1), opacity-100 550ms ease-out"
    : swiping.current || locked.current 
    ? "none "
    : "transform 520ms cubic-bezier(0.4, 0, 0.2, 1) opacity-100";

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: "pan-y", ...style }}
      className={`relative rounded-xl border select-none opacity-0 animate-fadeIn ${
        tarea.completada
          ? "bg-gray-50/60 border-gray-200/60"
          : "bg-white border-gray-200/80"
      } ${editing ? "" : "hover:border-brandCustom/25 hover:shadow-card-hover"}`}
    >
      <div
        className="absolute inset-0 rounded-xl flex items-center justify-start pl-5 pointer-events-none overflow-hidden transition-colors duration-150"
        style={{
          background: readyR
            ? tarea.completada
              ? "linear-gradient(90deg, #508484 0%, #3d6868 100%)"
              : "linear-gradient(90deg, #60993e 0%, #4a7a2f 100%)"
            : "transparent",
        }}
      >
        <div
          className="flex items-center gap-2.5 font-bold text-sm"
          style={{
            opacity: Math.min(1, revealRatioR * 1.5),
            transform: `scale(${0.9 + revealRatioR * 0.15}) translateX(${revealR * 0.1}px)`,
            color: readyR ? "#ffffff" : "#3d6824",
            textShadow: readyR ? "0 1px 3px rgba(0,0,0,0.25)" : "none",
          }}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
              readyR ? "bg-white/30 ring-2 ring-white/40" : "bg-greenCustom/15"
            }`}
          >
            <svg
              className={`w-5 h-5 transition-all ${readyR ? "text-white scale-110" : "text-greenCustom" }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="tracking-tight">{tarea.completada ? "Reabrir" : "Completar"}</span>
        </div>
      </div>

      <div
        className="absolute inset-0 rounded-xl flex items-center justify-end pr-5 pointer-events-none overflow-hidden transition-colors duration-150"
        style={{
          background: readyL
            ? "linear-gradient(270deg, #fe4a49 0%, #c73837 100%)"
            : "transparent",
        }}
      >
        <div
          className="flex items-center gap-2.5 font-bold text-sm"
          style={{
            opacity: Math.min(1, revealRatioL * 1.5),
            transform: `scale(${0.9 + revealRatioL * 0.15}) translateX(${-revealL * 0.1}px)`,
            color: readyL ? "#ffffff" : "#a31616",
            textShadow: readyL ? "0 1px 3px rgba(0,0,0,0.25)" : "none",
          }}
        >
          <span className="tracking-tight">Eliminar</span>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 ${
              readyL ? "bg-white/25 ring-2 ring-white/40" : "bg-redCustom/15"
            }`}
          >
            <svg
              className={`w-5 h-5 transition-all ${readyL ? "text-white scale-110" : "text-redCustom"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      </div>
      <div
        ref={innerRef}
        className={`relative rounded-xl ${
          exiting ? "opacity-0" : ""
        } ${flash === "complete" ? "animate-flash-complete" : ""} ${
          flash === "uncomplete" ? "animate-flash-uncomplete" : ""
        } ${justCompleted ? "scale-[0.985]" : ""}`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: cardTransition,
          background: tarea.completada ? "rgb(249 250 251)" : "white",
          borderLeftStyle: "solid",
          borderLeftColor: tarea.completada
            ? "transparent"
            : justCompleted
            ? "#60993e"
            : "#508484",
          willChange: swiping.current || locked.current ? "transform" : "auto",
        }}
        onClick={() => {
          if (didMove.current) didMove.current = false;
        }}
      >
        <div className="flex items-start gap-3 p-2">
          <button
            onClick={handleToggle}
            disabled={loading}
            className="mt-3 ml-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brandCustom/40 rounded-md"
            aria-label={tarea.completada ? "Marcar como pendiente" : "Marcar como completada"}
          >
            <div
              className={`relative w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                tarea.completada
                  ? "bg-greenCustom border-greenCustom shadow-sm"
                  : "border-gray-300 group-hover:border-brandCustom/60"
              }`}
            >
              <svg
                className={`w-3 h-3 text-white transition-all duration-200 ${
                  tarea.completada ? "opacity-100 scale-100" : "opacity-0 scale-75"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </button>

          <div className="flex-1 min-w-0 py-2.5 pr-1">
            {editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="w-full resize-none text-sm text-gray-900 bg-gray-50/80 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brandCustom/20 focus:border-brandCustom/40 transition-all placeholder:text-gray-400"
                  rows={2}
                  placeholder="Escribe la tarea..."
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={loading || !editText.trim()}
                    className="text-xs font-medium text-white bg-brandCustom hover:bg-brandCustom/85 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-all"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200/80 rounded-lg px-3 py-1.5 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p
                  className={`text-sm leading-relaxed cursor-pointer transition-colors duration-200 ${
                    tarea.completada
                      ? "line-through text-gray-400"
                      : "text-gray-800 hover:text-gray-950"
                  }`}
                  onClick={() => !tarea.completada && setEditing(true)}
                >
                  {tarea.texto}
                </p>

                <div className="flex items-center gap-2 mt-1.5">
                  {tarea.ticket_id && tarea.ticket_titulo && (
                    <Link
                      href={`/tickets/${tarea.ticket_id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-brandCustom/80 hover:text-brandCustom font-medium transition-colors bg-brandCustom/5 hover:bg-brandCustom/10 rounded-md px-1.5 py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      <span className="truncate max-w-[160px]">
                        #{tarea.ticket_id.slice(0, 6)} · {tarea.ticket_titulo}
                      </span>
                    </Link>
                  )}

                  <span className="text-[11px] text-gray-400/80 select-none">
                    {tiempoRelativo(tarea.fecha_creacion)}
                  </span>
                </div>
              </>
            )}

            {error && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </p>
            )}
          </div>

          {!editing && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="shrink-0 mt-3 mr-2 text-gray-300/0 group-hover:text-gray-300 hover:!text-red-400 transition-all duration-150 p-1 rounded-md hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              aria-label="Eliminar tarea"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
