"use client";

import { useEffect, useState } from "react";
import { respuestaRapidaApi, type RespuestaRapida } from "@/lib/endpoints";

type Props = {
  onInsert: (text: string) => void;
};

export function QuickReplies({ onInsert }: Props) {
  const [items, setItems] = useState<RespuestaRapida[]>([]);
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editando, setEditando] = useState<RespuestaRapida | null>(null);
  const [formTitulo, setFormTitulo] = useState("");
  const [formContenido, setFormContenido] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const data = await respuestaRapidaApi.listar();
      setItems(data);
    } catch {
      console.error("Error al cargar las respuestas rapidas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirCrear = () => {
    setEditando(null);
    setFormTitulo("");
    setFormContenido("");
    setManageOpen(true);
  };

  const abrirEditar = (rr: RespuestaRapida) => {
    setEditando(rr);
    setFormTitulo(rr.titulo);
    setFormContenido(rr.contenido);
    setManageOpen(true);
  };

  const guardar = async () => {
    if (guardando || !formTitulo.trim() || !formContenido.trim()) return;
    setGuardando(true);
    try {
      if (editando) {
        await respuestaRapidaApi.actualizar(editando.id, {
          titulo: formTitulo.trim(),
          contenido: formContenido.trim(),
        });
      } else {
        await respuestaRapidaApi.crear({
          titulo: formTitulo.trim(),
          contenido: formContenido.trim(),
        });
      }
      setManageOpen(false);
      await cargar();
    } catch {
      console.error("Error al guardar la respuesta rapida");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("Eliminar esta respuesta rapida?")) return;
    try {
      await respuestaRapidaApi.eliminar(id);
      await cargar();
    } catch {
      console.error("Error al eliminar la respuesta rapida");
    }
  };

  if (loading) return null;

  return (
    <div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full text-xs font-medium text-gray-600 tracking-wider hover:text-gray-900 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg
              className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Respuestas rápidas ({items.length})
          </span>
        </button>
        {open && (
          <div className="flex justify-between">
            <div className="flex flex-row-reverse gap-2">
              {items.map((rr) => (
              <div key={rr.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onInsert(rr.contenido)}
                  className="text-[11px] font-normal px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-brandCustom/10 hover:text-brandCustom border border-gray-200 hover:border-brandCustom/30 transition-all whitespace-nowrap"
                  title={rr.contenido}
                >
                  {rr.titulo}
                </button>
                <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditar(rr);
                    }}
                    className="w-4 h-4 rounded-full bg-gray-700 text-white hover:bg-brandCustom flex items-center justify-center"
                    title="Editar"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminar(rr.id);
                    }}
                    className="w-4 h-4 rounded-full bg-gray-700 text-white hover:bg-red-500 flex items-center justify-center"
                    title="Eliminar"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            </div>
            <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              abrirCrear();
            }}
            className="text-brandCustom hover:text-brandCustom/80 text-xs"
            >
              + Nueva
            </button>
          </div>
        )}
      </div>

      {manageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setManageOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900">
              {editando ? "Editar respuesta rápida" : "Nueva respuesta rápida"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-gray-500 tracking-wider block mb-1">
                  Titulo
                </label>
                <input
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ej: Saludo inicial"
                  maxLength={100}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-500 tracking-wider block mb-1">
                  Contenido
                </label>
                <textarea
                  value={formContenido}
                  onChange={(e) => setFormContenido(e.target.value)}
                  placeholder="Escriba el mensaje que se insertará..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-brandCustom focus:ring-1 focus:ring-brandCustom outline-none transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-normal text-gray-600 hover:bg-gray-100 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !formTitulo.trim() || !formContenido.trim()}
                className="rounded-xl bg-brandCustom px-4 py-2 text-xs font-normal text-white hover:bg-brandCustom/90 disabled:opacity-50 transition-all"
              >
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
