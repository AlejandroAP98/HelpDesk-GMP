"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAdjuntoBlob } from "@/hooks/useAdjuntoBlob";
import type { Adjunto } from "@/lib/endpoints";
import { formatBytes } from "@/lib/imageUtils";

type Props = {
  adjuntos: Adjunto[];
  onDelete?: (a: Adjunto) => void;
  deletingId?: string | null;
  className?: string;
  esMiComentario?: boolean;
  estaCerrado?: boolean;
};

function BrokenImageIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 3l18 18M3.75 19.5h16.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function InlineThumb({
  url,
  nombre,
  size,
  onClick,
  onDelete,
  isDeleting,
  esMiComentario,
  estaCerrado,
}: {
  url: string;
  nombre: string;
  size: number | null;
  onClick: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  esMiComentario?: boolean;
  estaCerrado?: boolean;
}) {
  const { url: blobUrl, loading, error } = useAdjuntoBlob(url);
  return (
    <div
      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in shadow-sm"
      onClick={onClick}
    >
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={nombre}
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
        />
      ) : loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <svg fill="none" className="w-4 h-4 animate-spin text-gray-300" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5z" className="opacity-75"/></svg>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-gray-400 bg-gray-100">
          <BrokenImageIcon className="w-8 h-8" />
          <span className="text-[9px] text-center px-2 leading-tight">{error ?? "Error"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[10px] text-white font-normal truncate" title={nombre}>
            {nombre}
          </p>
          <p className="text-[9px] text-gray-200 font-mono">{formatBytes(size)}</p>
        </div>
      </div>
      {onDelete && esMiComentario && !estaCerrado && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 flex items-center justify-center pointer-events-auto disabled:opacity-50 shadow-sm"
          title="Borrar"
        >
          {isDeleting ? (
            <svg fill="none" className="w-3 h-3 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5z" className="opacity-75"/></svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-trash-x" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M4 7h16M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m-5 5 4 4m0-4-4 4"/></svg>
          )}
        </button>
      )}
    </div>
  );
}

function LightboxImage({ url, alt }: { url: string; alt: string }) {
  const { url: blobUrl, loading, error } = useAdjuntoBlob(url);
  if (blobUrl) {
    return <img src={blobUrl} alt={alt} className="max-w-full max-h-[80vh] object-contain" />;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-white/80 bg-black/60 rounded-xl px-8 py-10 max-w-md">
        <BrokenImageIcon className="w-16 h-16" />
        <p className="text-sm font-normal text-center">{error}</p>
      </div>
    );
  }
  return (
    <div className="w-10 h-10">
      <svg fill="none" className="w-10 h-10 animate-spin text-white/50" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5z" className="opacity-75"/></svg>
    </div>
  );
}

function MoreImagesTile({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-zoom-in shadow-sm transition-colors"
    >
      <span className="text-2xl font-semibold text-gray-600 group-hover:text-gray-800">
        +{count}
      </span>
    </button>
  );
}

export function AdjuntosInline({ adjuntos, onDelete, deletingId, className = "", esMiComentario, estaCerrado }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const mostrarMas = adjuntos.length > 4;
  const visibles = mostrarMas ? adjuntos.slice(0, 3) : adjuntos;
  const ocultos = mostrarMas ? adjuntos.length - 3 : 0;

  const cerrarLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarLightbox();
      else if (e.key === "ArrowRight" && lightboxIndex < adjuntos.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
      } else if (e.key === "ArrowLeft" && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, adjuntos.length, cerrarLightbox]);

  useEffect(() => {
    if (lightboxIndex === null || lightboxIndex < adjuntos.length) return;
    setLightboxIndex(adjuntos.length > 0 ? adjuntos.length - 1 : null);
  }, [adjuntos.length, lightboxIndex]);

  if (adjuntos.length === 0) return null;

  return (
    <>
      <div
        className={`grid gap-2 ${
          adjuntos.length === 1
            ? "grid-cols-1 max-w-xs sm:max-w-sm"
            : "grid-cols-2 sm:grid-cols-2"
        } ${className}`}
      >
        {visibles.map((a, idx) => (
          <InlineThumb
            key={a.id}
            url={a.archivo_url}
            nombre={a.nombre_archivo}
            size={a.tamano_bytes}
            onClick={() => setLightboxIndex(idx)}
            onDelete={onDelete ? () => onDelete(a) : undefined}
            isDeleting={deletingId === a.id}
            esMiComentario={esMiComentario}
            estaCerrado={estaCerrado}
          />
        ))}
        {mostrarMas && (
          <MoreImagesTile
            count={ocultos}
            onClick={() => setLightboxIndex(3)}
          />
        )}
      </div>

      {lightboxIndex !== null && adjuntos[lightboxIndex] &&
        createPortal(
          <div
            className="fixed min-h-screen top-0 right-0 left-0 z-50 bg-black flex items-center justify-center p-4"
            onClick={cerrarLightbox}
          >
            {adjuntos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
                  }}
                  disabled={lightboxIndex === 0}
                  className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  title="Anterior"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (lightboxIndex < adjuntos.length - 1) {
                      setLightboxIndex(lightboxIndex + 1);
                    }
                  }}
                  disabled={lightboxIndex === adjuntos.length - 1}
                  className="absolute right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  title="Siguiente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            <div
              className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={cerrarLightbox}
                className="self-end w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Cerrar (Esc)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <LightboxImage
                url={adjuntos[lightboxIndex].archivo_url}
                alt={adjuntos[lightboxIndex].nombre_archivo}
              />
              <div className="mt-3 text-center">
                <p className="text-sm text-white font-normal">
                  {adjuntos[lightboxIndex].nombre_archivo}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {formatBytes(adjuntos[lightboxIndex].tamano_bytes)}
                  {adjuntos.length > 1 && (
                    <span className="ml-2">
                      {lightboxIndex + 1} / {adjuntos.length}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
