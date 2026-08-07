"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { adjuntoApi, type Adjunto } from "@/lib/endpoints";
import { useAdjuntoBlob } from "@/hooks/useAdjuntoBlob";
import {
  ALLOWED_IMAGE_ACCEPT,
  MAX_UPLOAD_BYTES,
  formatBytes,
  isImageMime,
  optimizeImage,
} from "@/lib/imageUtils";

type Props = {
  ticketId: string;
  adjuntos: Adjunto[];
  puedeSubir: boolean;
  puedeBorrar: (a: Adjunto) => boolean;
  onChanged: () => void;
  onError: (msg: string) => void;
};

function AdjuntoThumb({
  url,
  nombre,
  onClick,
  onDelete,
  size,
}: {
  url: string;
  nombre: string;
  size: number | null;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const { url: blobUrl, loading, error } = useAdjuntoBlob(url);
  return (
    <div
      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50 cursor-zoom-in"
      onClick={onClick}
    >
      {blobUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={blobUrl}
          alt={nombre}
          loading="lazy"
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <svg
            className="w-5 h-5 animate-spin text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
            />
          </svg>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-red-400 text-center px-1">
          {error ?? "Error"}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p
            className="text-[10px] text-white font-normal truncate"
            title={nombre}
          >
            {nombre}
          </p>
          <p className="text-[9px] text-gray-200 font-mono">
            {formatBytes(size)}
          </p>
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 flex items-center justify-center"
          title="Borrar"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function LightboxImage({ url, alt }: { url: string; alt: string }) {
  const { url: blobUrl, loading, error } = useAdjuntoBlob(url);
  if (blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={alt}
        className="max-w-full max-h-[80vh] object-contain"
      />
    );
  }
  if (error) {
    return (
      <div className="text-red-300 text-sm bg-black/60 rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }
  return (
    <div className="w-10 h-10">
      <svg
        className="w-10 h-10 animate-spin text-white/50"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
        />
      </svg>
    </div>
  );
}

export function AdjuntosGallery({
  ticketId,
  adjuntos,
  puedeSubir,
  puedeBorrar,
  onChanged,
  onError,
}: Props) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cerrarLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const targetX = 0
    const targetY = document.documentElement.scrollHeight / 2 -
      window.innerHeight / 2;
    window.scrollTo(targetX, targetY);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarLightbox();
      else if (e.key === "ArrowRight" && lightboxIndex < adjuntos.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
      } else if (e.key === "ArrowLeft" && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, adjuntos.length, cerrarLightbox]);

  useEffect(() => {
    if (lightboxIndex === null || lightboxIndex < adjuntos.length) return;
    setLightboxIndex(adjuntos.length > 0 ? adjuntos.length - 1 : null);
  }, [adjuntos.length, lightboxIndex]);

  const handleFiles = async (files: FileList) => {
    const lista = Array.from(files);
    if (lista.length === 0) return;

    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      if (!isImageMime(f.type)) {
        onError(`"${f.name}" no es una imagen valida (JPEG, PNG o WebP)`);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        onError(
          `"${f.name}" excede el tamano maximo (${formatBytes(MAX_UPLOAD_BYTES)})`,
        );
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }

    setSubiendo(true);
    try {
      for (let i = 0; i < lista.length; i++) {
        const f = lista[i];
        setProgreso(`Optimizando ${i + 1}/${lista.length}: ${f.name}`);
        const optimized = await optimizeImage(f);
        setProgreso(`Subiendo ${i + 1}/${lista.length}: ${optimized.name}`);
        await adjuntoApi.subir(ticketId, optimized);
      }
      onChanged();
    } catch {
      onError("No se pudo subir el adjunto");
    } finally {
      setSubiendo(false);
      setProgreso("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const borrar = async (a: Adjunto) => {
    if (!confirm(`Borrar "${a.nombre_archivo}"?`)) return;
    try {
      await adjuntoApi.eliminar(ticketId, a.id);
      onChanged();
    } catch {
      onError("No se pudo borrar el adjunto");
    }
  };

  return (
    <>
      {puedeSubir && (
        <div className="space-y-2">
          <label className="block w-full">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_ACCEPT}
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
              }}
              disabled={subiendo}
              className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 transition-all cursor-pointer disabled:opacity-50"
            />
          </label>
          {subiendo && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg
                className="w-4 h-4 animate-spin text-brandCustom"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                />
              </svg>
              <span>{progreso}</span>
            </div>
          )}
          <p className="text-[10px] text-gray-400">
            JPEG, PNG o WebP. Se redimensionan y optimizan antes de subir.
          </p>
        </div>
      )}

      {adjuntos.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">
          No hay imagenes adjuntas.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {adjuntos.map((a, idx) => (
            <AdjuntoThumb
              key={a.id}
              url={a.archivo_url}
              nombre={a.nombre_archivo}
              size={a.tamano_bytes}
              onClick={() => setLightboxIndex(idx)}
              onDelete={puedeBorrar(a) ? () => borrar(a) : undefined}
            />
          ))}
        </div>
      )}
      {lightboxIndex !== null && adjuntos[lightboxIndex] && (
        <div
          className="fixed min-h-screen inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
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
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
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
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
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
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
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
        </div>
      )}
    </>
  );
}
