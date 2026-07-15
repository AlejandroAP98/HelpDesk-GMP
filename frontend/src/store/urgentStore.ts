"use client";

import { create } from "zustand";

export type AlertKind = "urgent" | "assigned";

export interface UrgentAlert {
  id: string;
  kind: AlertKind;
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
  createdAt: number;
}

interface UrgentStore {
  alerts: UrgentAlert[];
  addAlert: (a: Omit<UrgentAlert, "id" | "createdAt" | "kind"> & { kind?: AlertKind }) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useUrgentStore = create<UrgentStore>((set) => ({
  alerts: [],
  addAlert: (a) =>
    set((s) => ({
      alerts: [
        {
          ...a,
          kind: a.kind ?? "urgent",
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        },
        ...s.alerts,
      ].slice(0, 20),
    })),
  dismiss: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  clear: () => set({ alerts: [] }),
}));