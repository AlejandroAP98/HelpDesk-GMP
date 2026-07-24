"use client";

import { useEffect, useState, useCallback } from "react";
import {
  categoriaApi,
  subcategoriaApi,
  matrizPrioridadApi,
  type Categoria,
  type Subcategoria,
  type MatrizPrioridadEntry,
  type ElementoInfraestructura,
  type PrioridadTicket,
} from "@/lib/endpoints";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import AddCagoryIcon from "@/app/assets/icons/AddCagoryIcon";
import AddSubCategoryIcon from "@/app/assets/icons/AddSubCategoryIcon";

const ELEMENTOS: { value: ElementoInfraestructura; label: string }[] = [
  { value: "torre", label: "Torre" },
  { value: "celda", label: "Celda" },
  { value: "mastil", label: "Mástil" },
  { value: "punto_venta", label: "Pto. Venta" },
];

const PRIORIDADES: { value: PrioridadTicket; label: string; color: string }[] = [
  { value: "baja", label: "Baja", color: "bg-gray-100 text-gray-700" },
  { value: "media", label: "Media", color: "bg-blue-100 text-blue-700" },
  { value: "alta", label: "Alta", color: "bg-orange-100 text-orange-700" },
  { value: "urgente", label: "Urgente", color: "bg-red-100 text-red-700" },
];

type MatrizGrid = Record<number, Record<ElementoInfraestructura, PrioridadTicket>>;

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [expandida, setExpandida] = useState<number | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [cargandoSubs, setCargandoSubs] = useState(false);

  const [matriz, setMatriz] = useState<MatrizGrid>({});
  const [matrizOriginal, setMatrizOriginal] = useState<MatrizGrid>({});
  const [guardandoMatriz, setGuardandoMatriz] = useState(false);
  const [matrizModificada, setMatrizModificada] = useState(false);

  const [modalCatOpen, setModalCatOpen] = useState(false);
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null);
  const [catNombre, setCatNombre] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [guardandoCat, setGuardandoCat] = useState(false);

  const [modalSubOpen, setModalSubOpen] = useState(false);
  const [editandoSub, setEditandoSub] = useState<Subcategoria | null>(null);
  const [subNombre, setSubNombre] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subCategoriaId, setSubCategoriaId] = useState<number>(0);
  const [guardandoSub, setGuardandoSub] = useState(false);

  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await categoriaApi.listar({ page, size: 20 });
      setCategorias(res.items);
      setTotalPages(res.pages);
    } catch {
      setError("No se pudieron cargar las categorías");
    } finally {
      setCargando(false);
    }
  }, [page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarMatriz = async (catId: number) => {
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
  };

  const toggleExpandir = async (catId: number) => {
    if (expandida === catId) {
      setExpandida(null);
      setSubcategorias([]);
      setMatriz({});
      setMatrizOriginal({});
      setMatrizModificada(false);
      return;
    }
    setExpandida(catId);
    setCargandoSubs(true);
    try {
      const [subRes] = await Promise.all([
        subcategoriaApi.listarPorCategoria(catId, { size: 50 }),
        cargarMatriz(catId),
      ]);
      setSubcategorias(subRes.items);
    } catch {
      setError("No se pudieron cargar las subcategorías");
    } finally {
      setCargandoSubs(false);
    }
  };

  const setPrioridadCelda = (
    subId: number,
    elemento: ElementoInfraestructura,
    prioridad: PrioridadTicket
  ) => {
    setMatriz((prev) => {
      const next = { ...prev };
      if (!next[subId]) {
        next[subId] = {} as Record<ElementoInfraestructura, PrioridadTicket>;
      }
      next[subId] = { ...next[subId], [elemento]: prioridad };
      return next;
    });
    setMatrizModificada(true);
  };

  const guardarMatriz = async () => {
    if (!expandida) return;
    setGuardandoMatriz(true);
    setError(null);
    try {
      const items: { subcategoria_id: number; elemento: ElementoInfraestructura; prioridad: PrioridadTicket }[] = [];
      for (const subId of Object.keys(matriz).map(Number)) {
        const row = matriz[subId];
        for (const elem of Object.keys(row) as ElementoInfraestructura[]) {
          items.push({ subcategoria_id: subId, elemento: elem, prioridad: row[elem] });
        }
      }
      await matrizPrioridadApi.sincronizarCategoria(expandida, items);
      setMatrizOriginal(JSON.parse(JSON.stringify(matriz)));
      setMatrizModificada(false);
    } catch {
      setError("Error al guardar la matriz de prioridad");
    } finally {
      setGuardandoMatriz(false);
    }
  };

  const abrirCrearCat = () => {
    setEditandoCat(null);
    setCatNombre("");
    setCatDesc("");
    setModalCatOpen(true);
  };

  const abrirEditarCat = (c: Categoria) => {
    setEditandoCat(c);
    setCatNombre(c.nombre);
    setCatDesc(c.descripcion ?? "");
    setModalCatOpen(true);
  };

  const guardarCat = async () => {
    if (!catNombre.trim()) return;
    setGuardandoCat(true);
    setError(null);
    try {
      if (editandoCat) {
        await categoriaApi.actualizar(editandoCat.id, {
          nombre: catNombre.trim(),
          descripcion: catDesc.trim() || undefined,
        });
      } else {
        await categoriaApi.crear({
          nombre: catNombre.trim(),
          descripcion: catDesc.trim() || undefined,
        });
      }
      setModalCatOpen(false);
      await cargar();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    } finally {
      setGuardandoCat(false);
    }
  };

  const eliminarCat = async (id: number) => {
    if (!confirm("¿Eliminar esta categoría? Se eliminarán sus subcategorías.")) return;
    setEliminandoId(id);
    setError(null);
    try {
      await categoriaApi.eliminar(id);
      if (expandida === id) {
        setExpandida(null);
        setSubcategorias([]);
        setMatriz({});
        setMatrizOriginal({});
      }
      await cargar();
    } catch {
      setError("No se pudo eliminar. Verifique que no tenga tickets asociados.");
    } finally {
      setEliminandoId(null);
    }
  };

  const abrirCrearSub = (catId: number) => {
    setEditandoSub(null);
    setSubNombre("");
    setSubDesc("");
    setSubCategoriaId(catId);
    setModalSubOpen(true);
  };

  const abrirEditarSub = (s: Subcategoria) => {
    setEditandoSub(s);
    setSubNombre(s.nombre);
    setSubDesc(s.descripcion ?? "");
    setSubCategoriaId(s.categoria_id);
    setModalSubOpen(true);
  };

  const guardarSub = async () => {
    if (!subNombre.trim()) return;
    setGuardandoSub(true);
    setError(null);
    try {
      if (editandoSub) {
        await subcategoriaApi.actualizar(editandoSub.id, {
          nombre: subNombre.trim(),
          descripcion: subDesc.trim() || undefined,
        });
      } else {
        await subcategoriaApi.crear({
          categoria_id: subCategoriaId,
          nombre: subNombre.trim(),
          descripcion: subDesc.trim() || undefined,
        });
      }
      setModalSubOpen(false);
      if (expandida) {
        const res = await subcategoriaApi.listarPorCategoria(expandida, { size: 50 });
        setSubcategorias(res.items);
        await cargarMatriz(expandida);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    } finally {
      setGuardandoSub(false);
    }
  };

  const eliminarSub = async (id: number) => {
    if (!confirm("¿Eliminar esta subcategoría?")) return;
    setEliminandoId(id);
    setError(null);
    try {
      await subcategoriaApi.eliminar(id);
      if (expandida) {
        const res = await subcategoriaApi.listarPorCategoria(expandida, { size: 50 });
        setSubcategorias(res.items);
        await cargarMatriz(expandida);
      }
    } catch {
      setError("No se pudo eliminar la subcategoría");
    } finally {
      setEliminandoId(null);
    }
  };

  const PRIORIDAD_COLORS: Record<string, string> = {
    baja: "text-gray-600",
    media: "text-blue-600",
    alta: "text-orange-600",
    urgente: "text-red-600 font-semibold",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona categorías, subcategorías y matriz de prioridad
          </p>
        </div>
        <Button onClick={abrirCrearCat} className="text-nowrap" icon={<AddCagoryIcon />}>Nueva categoría</Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {cargando ? (
        <LoadingState />
      ) : categorias.length === 0 ? (
        <EmptyState message="No hay categorías registradas." />
      ) : (
        <>
          <div className="space-y-3">
            {categorias.map((cat) => (
              <div key={cat.id} className="bg-cardCustom rounded-2xl border border-cardCustom/50 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpandir(cat.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        className={`transition-transform ${expandida === cat.id ? "rotate-90" : ""}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    <div>
                      <span className="font-medium text-gray-900 text-sm sm:text-base">{cat.nombre}</span>
                      {cat.descripcion && (
                        <span className="text-gray-400 text-xs ml-2 sm:text-sm">— {cat.descripcion}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => abrirCrearSub(cat.id)} className="sm:py-2 py-1 sm:px-2.5 px-1 sm:text-sm !text-[10px]" icon={<AddSubCategoryIcon />}>
                      Sub Categoría
                    </Button>
                    <Button variant="secondary" onClick={() => abrirEditarCat(cat)} className="py-1 px-2.5 text-xs">
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => eliminarCat(cat.id)}
                      loading={eliminandoId === cat.id}
                      className="py-1 px-2.5 sm:py-2 bg-redCustom/90 hover:bg-redCustom text-xs"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                {expandida === cat.id && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    {cargandoSubs ? (
                      <div className="px-5 py-4 text-sm text-gray-400">Cargando subcategorías...</div>
                    ) : subcategorias.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400">No hay subcategorías.</div>
                    ) : (
                      <>
                        <div className="divide-y divide-gray-100">
                          {subcategorias.map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between px-5 py-2.5 pl-12">
                              <div>
                                <span className="text-sm text-gray-700">{sub.nombre}</span>
                                {sub.descripcion && (
                                  <span className="text-gray-400 text-xs ml-2">— {sub.descripcion}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="secondary" onClick={() => abrirEditarSub(sub)} className="py-1 px-2.5 !text-[10px]">
                                  Editar
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => eliminarSub(sub.id)}
                                  loading={eliminandoId === sub.id}
                                  className="py-1 px-2.5 !text-[10px] bg-redCustom/90 hover:!bg-redCustom"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="px-5 py-4 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Matriz de Prioridad
                            </h4>
                            {matrizModificada && (
                              <Button
                                onClick={guardarMatriz}
                                loading={guardandoMatriz}
                                className="text-xs py-1.5 px-3"
                              >
                                Guardar matriz
                              </Button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 pr-3 font-medium text-gray-500 min-w-[140px]">
                                    Subcategoría
                                  </th>
                                  {ELEMENTOS.map((e) => (
                                    <th key={e.value} className="text-center py-2 px-2 font-medium text-gray-500">
                                      {e.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subcategorias.map((sub) => (
                                  <tr key={sub.id} className="border-b border-gray-100 last:border-0">
                                    <td className="py-2 pr-3 text-gray-700 font-medium truncate max-w-[180px]">
                                      {sub.nombre}
                                    </td>
                                    {ELEMENTOS.map((elem) => {
                                      const current = matriz[sub.id]?.[elem.value] ?? "media";
                                      return (
                                        <td key={elem.value} className="text-center py-2 px-1">
                                          <select
                                            value={current}
                                            onChange={(e) =>
                                              setPrioridadCelda(
                                                sub.id,
                                                elem.value,
                                                e.target.value as PrioridadTicket
                                              )
                                            }
                                            className={`text-[11px] rounded-lg border border-gray-200 bg-white px-1.5 py-1 cursor-pointer focus:border-brand-500 focus:ring-1 focus:ring-brandCustom outline-none transition-all ${PRIORIDAD_COLORS[current] ?? ""}`}
                                          >
                                            {PRIORIDADES.map((p) => (
                                              <option key={p.value} value={p.value}>
                                                {p.label}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}

      {modalCatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editandoCat ? "Editar categoría" : "Nueva categoría"}
            </h2>
            <div className="space-y-4">
              <Input
                label="Nombre"
                value={catNombre}
                onChange={(e) => setCatNombre(e.target.value)}
                placeholder="Nombre de la categoría"
                autoFocus
              />
              <Input
                label="Descripción (opcional)"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Descripción breve"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModalCatOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarCat} loading={guardandoCat} disabled={!catNombre.trim()}>
                  {editandoCat ? "Guardar cambios" : "Crear categoría"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {modalSubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editandoSub ? "Editar subcategoría" : "Nueva subcategoría"}
            </h2>
            <div className="space-y-4">
              <Input
                label="Nombre"
                value={subNombre}
                onChange={(e) => setSubNombre(e.target.value)}
                placeholder="Nombre de la subcategoría"
                autoFocus
              />
              <Input
                label="Descripción (opcional)"
                value={subDesc}
                onChange={(e) => setSubDesc(e.target.value)}
                placeholder="Descripción breve"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setModalSubOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarSub} loading={guardandoSub} disabled={!subNombre.trim()}>
                  {editandoSub ? "Guardar cambios" : "Crear subcategoría"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
