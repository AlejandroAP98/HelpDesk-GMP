"use client";

import { useState, useCallback } from "react";
import {
  matrizPrioridadApi,
  type ElementoInfraestructura,
  type PrioridadTicket,
} from "@/lib/endpoints";

export type MatrizGrid = Record<number, Record<ElementoInfraestructura, PrioridadTicket>>;

export function useMatrizPrioridad() {
  const [matriz, setMatriz] = useState<MatrizGrid>({});
  const [matrizOriginal, setMatrizOriginal] = useState<MatrizGrid>({});
  const [guardandoMatriz, setGuardandoMatriz] = useState(false);
  const [matrizModificada, setMatrizModificada] = useState(false);

  const cargarMatriz = useCallback(async (catId: number) => {
    try {
      const entries = await matrizPrioridadApi.listarPorCategoria(catId);
      const grid: MatrizGrid = {};
      for (const e of entries) {
        if (!grid[e.subcategoria_id]) {
          grid[e.subcategoria_id] = {} as Record<ElementoInfraestructura, PrioridadTicket>;
        }
        grid[e.subcategoria_id][e.elemento] = e.prioridad;
      }
      setMatriz(grid);
      setMatrizOriginal(JSON.parse(JSON.stringify(grid)));
      setMatrizModificada(false);
    } catch {
      setMatriz({});
      setMatrizOriginal({});
    }
  }, []);

  const limpiarMatriz = useCallback(() => {
    setMatriz({});
    setMatrizOriginal({});
    setMatrizModificada(false);
  }, []);

  const setPrioridadCelda = useCallback(
    (subId: number, elemento: ElementoInfraestructura, prioridad: PrioridadTicket) => {
      setMatriz((prev) => {
        const next = { ...prev };
        if (!next[subId]) {
          next[subId] = {} as Record<ElementoInfraestructura, PrioridadTicket>;
        }
        next[subId] = { ...next[subId], [elemento]: prioridad };
        return next;
      });
      setMatrizModificada(true);
    },
    []
  );

  const guardarMatriz = useCallback(
    async (catId: number) => {
      setGuardandoMatriz(true);
      try {
        const items: { subcategoria_id: number; elemento: ElementoInfraestructura; prioridad: PrioridadTicket }[] = [];
        for (const subId of Object.keys(matriz).map(Number)) {
          const row = matriz[subId];
          for (const elem of Object.keys(row) as ElementoInfraestructura[]) {
            items.push({ subcategoria_id: subId, elemento: elem, prioridad: row[elem] });
          }
        }
        await matrizPrioridadApi.sincronizarCategoria(catId, items);
        setMatrizOriginal(JSON.parse(JSON.stringify(matriz)));
        setMatrizModificada(false);
      } finally {
        setGuardandoMatriz(false);
      }
    },
    [matriz]
  );

  return {
    matriz, matrizOriginal, guardandoMatriz, matrizModificada,
    cargarMatriz, limpiarMatriz, setPrioridadCelda, guardarMatriz,
  };
}
