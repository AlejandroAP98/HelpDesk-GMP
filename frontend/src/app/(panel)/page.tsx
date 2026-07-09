"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, type Ticket, type PrioridadTicket, type EstadoTicket } from "@/lib/endpoints";
import { useWsTicketStore } from "@/store/wsTicketStore";
import { EstadoBadge, PrioridadBadge } from "@/components/Badges";
import NewTicketIcon from "../assets/icons/NewTicketIcon";

export default function PanelHomePage() {
  const usuario = useAuthStore((s) => s.usuario);
  const [recientes, setRecientes] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const data = await ticketApi.listar({ size: 5 });
        setRecientes(data.items);
      } catch {
        setRecientes([]);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const setOnTicketCreated = useWsTicketStore((s) => s.setOnTicketCreated);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const empresaId = usuario?.empresa_id;

  useEffect(() => {
    setOnTicketCreated((ev) => {
      if (usuario?.rol === "cliente" && empresaId != null && ev.empresa_id !== empresaId) return;
      setRecientes((prev) => {
        if (prev.some((t) => t.id === ev.ticket_id)) return prev;
        const nuevo: Ticket = {
          id: ev.ticket_id,
          empresa_id: ev.empresa_id,
          titulo: ev.titulo,
          descripcion: "",
          categoria_id: 0,
          prioridad: ev.prioridad as PrioridadTicket,
          estado: ev.estado as EstadoTicket,
          cliente_id: ev.cliente_id ?? "",
          agente_id: ev.agente_id,
          modificado_por_id: null,
          modificado_por_nombre: null,
          fecha_creacion: ev.fecha_actualizacion,
          fecha_actualizacion: ev.fecha_actualizacion,
        };
        return [nuevo, ...prev].slice(0, 5);
      });
    });

    setOnTicketUpdated((ev) => {
      setRecientes((prev) =>
        prev.map((t) =>
          t.id === ev.ticket_id
            ? {
                ...t,
                estado: ev.estado as EstadoTicket,
                prioridad: ev.prioridad as PrioridadTicket,
                agente_id: ev.agente_id,
                fecha_actualizacion: ev.fecha_actualizacion,
              }
            : t
        )
      );
    });

    return () => {
      setOnTicketCreated(null);
      setOnTicketUpdated(null);
    };
  }, [setOnTicketCreated, setOnTicketUpdated, usuario?.rol, empresaId]);

  const esCliente = usuario?.rol === "cliente";
  const esAdmin = usuario?.rol === "administrador";
  const esAgente = usuario?.rol === "agente";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Hola, {usuario?.nombre?.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {esCliente && "Gestiona tus tickets de soporte de manera eficiente"}
            {esAgente && "Revisa y resuelve tus tickets asignados"}
            {esAdmin && "Panel de administracion y control global"}
          </p>
        </div>
        {esCliente && (
          <Link
            href="/tickets/nuevo"
            className="inline-flex items-center gap-2 rounded-xl bg-brandCustom px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 shadow-brand active:scale-[0.98] transition-all"
          >
            <NewTicketIcon />
            Crear nuevo ticket
          </Link>
        )}
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Tickets recientes</h2>
          <Link href="/tickets" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
            Ver todos &rarr;
          </Link>
        </div>

        {cargando ? (
          <p className="py-8 text-center text-sm text-gray-400">Cargando...</p>
        ) : recientes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No hay tickets todavia.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[500px]">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wider uppercase">Titulo</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wider uppercase">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wider uppercase">Prioridad</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wider uppercase">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recientes.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link href={`/tickets/${t.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors">
                        {t.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoBadge estado={t.estado} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PrioridadBadge prioridad={t.prioridad} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs">
                      {new Date(t.fecha_actualizacion).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
