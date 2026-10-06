"use client";

import { useEffect, useState } from "react";

export function PausaModal({
  open,
  motivoSugerido = "",
  procesando,
  onClose,
  onConfirm,
}: {
  open: boolean;
  motivoSugerido?: string;
  procesando: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMotivo(motivoSugerido);
      setError(null);
    }
  }, [open, motivoSugerido]);

  if (!open) return null;

  const handleSubmit = () => {
    if (motivo.trim().length < 3) {
      setError("El motivo debe tener al menos 3 caracteres");
      return;
    }
    if (motivo.trim().length > 500) {
      setError("El motivo debe tener maximo 500 caracteres");
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90  p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !procesando) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-elevated border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-amberCustom/5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
            Pausar ticket
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block text-[11px] font-medium text-gray-600 uppercase tracking-wider">
            Motivo de la pausa
          </label>
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError(null);
              if (e.target.value.length > 500) setError("Maximo 500 caracteres");
            }}
            rows={3}
            placeholder="Ej: Esperando permiso de acceso del cliente"
            disabled={procesando}
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 sm:text-sm text-xs text-gray-900 placeholder-gray-400 focus:border-amberCustom focus:ring-1 focus:ring-amberCustom outline-none transition-all resize-none"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{error}</span>
            <span>{motivo.length}/500</span>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={procesando}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={procesando}
            className="px-3 py-2 rounded-lg bg-slate-500 hover:bg-slate-400 text-white text-xs font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {procesando ? "Pausando..." : "Pausar ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}