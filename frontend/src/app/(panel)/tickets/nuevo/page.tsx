"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { categoriaApi, ticketApi, type Categoria, type PrioridadTicket } from "@/lib/endpoints";

const PRIORIDADES: PrioridadTicket[] = ["baja", "media", "alta", "urgente"];

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
      const t = await ticketApi.crear({ titulo, descripcion, categoria_id: categoriaId, prioridad });
      router.push(`/tickets/${t.id}`);
    } catch {
      setError("Error al crear el ticket");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Nuevo ticket</h1>
      <form onSubmit={submit} className="space-y-4 bg-white rounded-lg border border-slate-200 p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Titulo</span>
          <input
            type="text"
            required
            maxLength={150}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Descripcion</span>
          <textarea
            required
            rows={6}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Categoria</span>
            <select
              value={categoriaId ?? ""}
              onChange={(e) => setCategoriaId(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Prioridad</span>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Crear ticket"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}