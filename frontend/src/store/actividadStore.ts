"use client";

import { create } from "zustand";
import type { ActividadLog } from "@/lib/endpoints";

interface ActividadStore {
  items: ActividadLog[];
  setItems: (items: ActividadLog[]) => void;
  addNewItem: (item: ActividadLog) => void;
}

export const useActividadStore = create<ActividadStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addNewItem: (item) =>
    set((state) => ({
      items: [item, ...state.items].slice(0, 50),
    })),
}));
