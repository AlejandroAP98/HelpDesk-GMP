"use client";

import { create } from "zustand";
import type { VistaTicket } from "@/lib/endpoints";

export type EnPausaFiltro = "todos" | "en_pausa" | "activos";

interface TicketsFilterState {
  estado: string;
  prioridad: string;
  vista: VistaTicket;
  fechaInicio: string;
  fechaFin: string;
  filtroEmpresaId: string;
  filtroAgenteId: string;
  filtroPuntoVentaId: string;
  busqueda: string;
  enPausaFiltro: EnPausaFiltro;
  page: number;

  setEstado: (v: string) => void;
  setPrioridad: (v: string) => void;
  setVista: (v: VistaTicket) => void;
  setFechaInicio: (v: string) => void;
  setFechaFin: (v: string) => void;
  setFiltroEmpresaId: (v: string) => void;
  setFiltroAgenteId: (v: string) => void;
  setFiltroPuntoVentaId: (v: string) => void;
  setBusqueda: (v: string) => void;
  setEnPausaFiltro: (v: EnPausaFiltro) => void;
  setPage: (v: number | ((p: number) => number)) => void;
  limpiarTodo: () => void;
}

const defaults = {
  estado: "todos",
  prioridad: "todas",
  vista: "activos" as VistaTicket,
  fechaInicio: "",
  fechaFin: "",
  filtroEmpresaId: "",
  filtroAgenteId: "",
  filtroPuntoVentaId: "",
  busqueda: "",
  enPausaFiltro: "todos" as EnPausaFiltro,
  page: 1,
};

export const useTicketsFilterStore = create<TicketsFilterState>((set) => ({
  ...defaults,
  setEstado: (v) => set({ estado: v }),
  setPrioridad: (v) => set({ prioridad: v }),
  setVista: (v) => set({ vista: v }),
  setFechaInicio: (v) => set({ fechaInicio: v }),
  setFechaFin: (v) => set({ fechaFin: v }),
  setFiltroEmpresaId: (v) => set({ filtroEmpresaId: v }),
  setFiltroAgenteId: (v) => set({ filtroAgenteId: v }),
  setFiltroPuntoVentaId: (v) => set({ filtroPuntoVentaId: v }),
  setBusqueda: (v) => set({ busqueda: v }),
  setEnPausaFiltro: (v) => set({ enPausaFiltro: v }),
  setPage: (v) =>
    set((state) => ({ page: typeof v === "function" ? v(state.page) : v })),
  limpiarTodo: () => set({ ...defaults }),
}));
