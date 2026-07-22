"use client";

import { useEffect, useState, useCallback } from "react";
import { tareaApi, ticketApi, type TareaPendiente, type Ticket, type Pagina } from "@/lib/endpoints";
import { extractApiError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import TareaCard from "@/components/TareaCard";
import AddCheckSquareIcon from "@/app/assets/icons/AddCheckSquareIcon";

type FiltroTab = "pendientes" | "completadas" | "todas";

export default function TareasPage() {
  const [tareas, setTareas] = useState<TareaPendiente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filtro, setFiltro] = useState<FiltroTab>("pendientes");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoTexto, setNuevoTexto] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [creando, setCreando] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const cargarTareas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, size: 20 };
      if (filtro === "pendientes") params.completada = false;
      if (filtro === "completadas") params.completada = true;
      const data: Pagina<TareaPendiente> = await tareaApi.listar(params);
      setTareas(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setCargando(false);
    }
  }, [page, filtro]);

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showForm) {
      ticketApi.listar({ size: 100, vista: "activos" }).then((data) => {
        setTickets(data.items);
      }).catch(() => undefined);
    }
  }, [showForm]);

  const handleCrear = async () => {
    if (!nuevoTexto.trim()) return;
    setCreando(true);
    try {
      const tarea = await tareaApi.crear({
        texto: nuevoTexto.trim(),
        ticket_id: ticketId || null,
      });
      setTareas((prev) => [tarea, ...prev]);
      setTotal((prev) => prev + 1);
      setNuevoTexto("");
      setTicketId("");
      setShowForm(false);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = (id: string, completada: boolean) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completada } : t))
    );
  };

  const handleDelete = (id: string) => {
    setTareas((prev) => prev.filter((t) => t.id !== id));
    setTotal((prev) => prev - 1);
  };

  const handleUpdate = (id: string, data: Partial<TareaPendiente>) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Mis Tareas</h1>
          <h2 className="text-gray-500 text-sm">Gestioná y organizá tus tareas diarias.</h2>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<AddCheckSquareIcon />} className="text-xs py-2.5 px-3 sm:text-base sm:px-3 text-nowrap">
          Nueva tarea
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <span className="text-sm text-gray-500">Nueva tarea</span>
          <textarea
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCrear()}
            placeholder="¿Qué necesitas hacer?"
            className="w-full resize-none p-2 min-h-20 max-h-64 text-sm text-gray-900 bg-gray-50/80 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brandCustom/20 focus:border-brandCustom/40 transition-all placeholder:text-gray-400"
            autoFocus
          />
          <div className="flex flex-col gap-2 sm:flex-row items-start sm:items-center justify-start mt-3 sm:justify-between">
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border max-w-xs  border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brandCustom bg-white"
            >
              <option value="">Sin vínculo a ticket</option>
              {tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id.slice(0, 8)} - {t.titulo}
                </option>
              ))}
            </select>
            <div className="flex gap-1 justify-start items-center">
              <Button onClick={handleCrear} loading={creando} disabled={!nuevoTexto.trim()}  className="text-xs py-2.5 px-3 text-nowrap">
                Crear
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setNuevoTexto(""); setTicketId(""); }}  className="text-xs py-2.5 px-3 text-nowrap">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full border-b border-grayCustom/50 bg-grayCustom/10  rounded-lg h-fit text-nowrap mb-1">
        {(["pendientes", "completadas","todas"] as FiltroTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFiltro(tab); setPage(1); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              filtro === tab
                ? "bg-brandCustom text-white shadow-sm"
                : "text-grayCustom hover:text-gray-700"
            }`}
          >
            {tab === "pendientes" && `Pendientes`}
            {tab === "completadas" && `Completadas`}
            {tab === "todas" && `Todas`}
          </button>
        ))}
      </div>

      {cargando ? (
        <LoadingState />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={cargarTareas}>
            Reintentar
          </Button>
        </div>
      ) : tareas.length === 0 ? (
        <EmptyState
          message={
            filtro === "completadas"
              ? "No tienes tareas completadas"
              : filtro === "pendientes"
              ? "No tienes tareas pendientes. ¡Buen trabajo!"
              : "No tienes tareas creadas"
          }
        />
      ) : (
        <div className="bg-cardCustom p-4 mt-2 rounded-2xl shadow-sm flex flex-col gap-2 min-h-[70vh]">
          <div
            className={`flex w-full justify-center items-center gap-1 text-gray-400 animate-pulse transition-all duration-700 ease-out ${
              isVisible
                ? 'opacity-100 max-h-12'
                : 'opacity-0 max-h-0 overflow-hidden pointer-events-none m-0 p-0'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-move-left" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M13 12H3m3 3-3-3 3-3m11 3a2 2 0 1 1 4 0 2 2 0 0 1-4 0"/></svg>
            <span className="text-gray-400 text-[10px] w-full flex justify-center">Puedes deslizar para editar, eliminar o marcar como completada</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-move-right" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M11 12h10m-3-3 3 3-3 3M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0"/></svg>
          </div>
          {tareas.map((tarea: TareaPendiente, index: number) => (
            <TareaCard
              key={tarea.id}
              tarea={tarea}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              style={{ animationDelay: `${index * 40}ms`, animationFillMode: "forwards" }}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
