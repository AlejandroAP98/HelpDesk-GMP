"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { ticketApi, type Ticket } from "@/lib/endpoints";

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

  const esCliente = usuario?.rol === "cliente";
  const esAdmin = usuario?.rol === "administrador";
  const esAgente = usuario?.rol === "agente";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Hola, {usuario?.nombre?.split(" ")[0]}
        </h1>
        <p className="text-slate-500">
          {esCliente && "Gestiona tus tickets de soporte"}
          {esAgente && "Tus tickets asignados"}
          {esAdmin && "Panel de administracion"}
        </p>
      </div>

      {esCliente && (
        <Link
          href="/tickets/nuevo"
          className="inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Crear nuevo ticket
        </Link>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Tickets recientes</h2>
          <Link href="/tickets" className="text-sm text-brand hover:underline">
            Ver todos
          </Link>
        </div>

        {cargando ? (
          <p className="py-6 text-sm text-slate-400">Cargando...</p>
        ) : recientes.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No hay tickets todavia.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">Titulo</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Prioridad</th>
                  <th className="px-4 py-2 text-left">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recientes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${t.id}`} className="font-medium text-slate-800 hover:text-brand">
                        {t.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={t.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <PrioridadBadge prioridad={t.prioridad} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
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

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    abierto: "bg-blue-100 text-blue-700",
    asignado: "bg-purple-100 text-purple-700",
    en_progreso: "bg-amber-100 text-amber-700",
    resuelto: "bg-green-100 text-green-700",
    cerrado: "bg-slate-200 text-slate-600",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[estado] ?? ""}`}>
      {estado}
    </span>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const styles: Record<string, string> = {
    baja: "bg-slate-100 text-slate-600",
    media: "bg-sky-100 text-sky-700",
    alta: "bg-orange-100 text-orange-700",
    urgente: "bg-red-100 text-red-700 font-bold",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[prioridad] ?? ""}`}>
      {prioridad}
    </span>
  );
}