"use client";

import { useCallback, useEffect, useState } from "react";

interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface UseCrudPageOptions<T, TForm, K extends string | number> {
  listar: (params: Record<string, unknown>) => Promise<Pagina<T>>;
  crear: (form: TForm) => Promise<unknown>;
  actualizar: (item: T, form: TForm) => Promise<unknown>;
  eliminar: (item: T) => Promise<unknown>;
  keyOf: (item: T) => K;
  emptyForm: () => TForm;
  toForm: (item: T) => TForm;
  pageSize?: number;
  filtros?: Record<string, unknown>;
  errorFrom?: (err: unknown, fallback: string) => string;
  confirmarEliminar?: (item: T) => boolean;
  mensajes?: {
    cargar?: string;
    guardar?: string;
    eliminar?: string;
  };
}

export function useCrudPage<T, TForm, K extends string | number>(
  options: UseCrudPageOptions<T, TForm, K>,
) {
  const {
    listar, crear, actualizar, eliminar: eliminarFn, keyOf,
    emptyForm, toForm, pageSize = 15, filtros,
    errorFrom, confirmarEliminar, mensajes,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<T | null>(null);
  const [form, setForm] = useState<TForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoKey, setEliminandoKey] = useState<K | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listar({ page, size: pageSize, ...filtros });
      setItems(res.items);
      setTotalPages(res.pages);
    } catch {
      setError(mensajes?.cargar ?? "No se pudieron cargar los datos");
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCrear = useCallback(() => {
    setEditando(null);
    setForm(emptyForm());
    setModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirEditar = useCallback((item: T) => {
    setEditando(item);
    setForm(toForm(item));
    setModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrarModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const guardar = useCallback(async () => {
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await actualizar(editando, form);
      } else {
        await crear(form);
      }
      setModalOpen(false);
      await cargar();
    } catch (err: unknown) {
      const fallback = mensajes?.guardar ?? "Error al guardar";
      setError(errorFrom ? errorFrom(err, fallback) : err instanceof Error ? err.message : fallback);
    } finally {
      setGuardando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, form, actualizar, crear, cargar]);

  const eliminar = useCallback(async (item: T) => {
    if (confirmarEliminar && !confirmarEliminar(item)) return;
    setEliminandoKey(keyOf(item));
    setError(null);
    try {
      await eliminarFn(item);
      await cargar();
    } catch (err: unknown) {
      const fallback = mensajes?.eliminar ?? "No se pudo eliminar";
      setError(errorFrom ? errorFrom(err, fallback) : fallback);
    } finally {
      setEliminandoKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmarEliminar, eliminarFn, cargar, keyOf]);

  return {
    items, cargando, error, setError,
    page, totalPages, setPage,
    modalOpen, editando, form, setForm,
    guardando, eliminandoKey,
    abrirCrear, abrirEditar, cerrarModal, guardar, eliminar, cargar,
  };
}
