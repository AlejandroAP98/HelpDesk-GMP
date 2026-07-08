"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { categoriaApi, ticketApi, type Categoria, type PrioridadTicket } from "@/lib/endpoints";

const PRIORIDADES: PrioridadTicket[] = ["baja", "media", "alta", "urgente"];

const prioridadLabels: Record<string, { label: string; color: string }> = {
  baja: { label: "Baja", color: "bg-gray-100 text-gray-600" },
  media: { label: "Media", color: "bg-sky-100 text-sky-700" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

export default function NuevoTicketPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [prioridad, setPrioridad] = useState<PrioridadTicket>("media");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    categoriaApi.listar().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoriaId) {
      setError("Seleccione una categoria");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await ticketApi.crear({ titulo, descripcion, categoria_id: categoriaId, prioridad });
      router.replace("/tickets");
    } catch {
      setError("Error al crear el ticket");
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Nuevo Ticket</h1>
      <form onSubmit={submit} className="space-y-5 bg-white rounded-2xl border border-gray-100 shadow-card p-8">
        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Titulo</span>
          <input
            type="text"
            required
            maxLength={150}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all"
            placeholder="Escriba un titulo descriptivo"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Descripcion</span>
          <textarea
            required
            rows={5}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all resize-none"
            placeholder="Describa el problema detalladamente"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Categoria</span>
            <select
              value={categoriaId ?? ""}
              onChange={(e) => setCategoriaId(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-700 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all cursor-pointer"
            >
              <option value="">Seleccione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Prioridad</span>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 text-gray-700 px-4 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-50 focus:bg-white outline-none transition-all cursor-pointer"
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{prioridadLabels[p]?.label ?? p}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-brand active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {enviando ? "Enviando..." : "Crear ticket"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
