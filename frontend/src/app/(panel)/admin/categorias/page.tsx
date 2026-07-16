"use client";

import { useEffect, useState, useCallback } from "react";
import { categoriaApi, subcategoriaApi, type Categoria, type Subcategoria } from "@/lib/endpoints";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import AddCagoryIcon from "@/app/assets/icons/AddCagoryIcon";
import AddSubCategoryIcon from "@/app/assets/icons/AddSubCategoryIcon";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [expandida, setExpandida] = useState<number | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [cargandoSubs, setCargandoSubs] = useState(false);

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

  const toggleExpandir = async (catId: number) => {
    if (expandida === catId) {
      setExpandida(null);
      setSubcategorias([]);
      return;
    }
    setExpandida(catId);
    setCargandoSubs(true);
    try {
      const res = await subcategoriaApi.listarPorCategoria(catId, { size: 50 });
      setSubcategorias(res.items);
    } catch {
      setError("No se pudieron cargar las subcategorías");
    } finally {
      setCargandoSubs(false);
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
      }
    } catch {
      setError("No se pudo eliminar la subcategoría");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona categorías y subcategorías de tickets</p>
        </div>
        <Button onClick={abrirCrearCat} className="text-xs py-2.5 px-3 sm:text-base sm:px-3 text-nowrap" icon={<AddCagoryIcon />}>Nueva categoría</Button>
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
                        <span className="text-gray-400 text-xs ml-2  sm:text-sm">— {cat.descripcion}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => abrirCrearSub(cat.id)} className="sm:py-2 py-1 sm:px-2.5 px-1 sm:text-sm !text-[10px] " icon={<AddSubCategoryIcon />}>
                      Sub Categoría
                    </Button>
                    <Button variant="secondary" onClick={() => abrirEditarCat(cat)} className="py-1 px-2.5 text-xs ">
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => eliminarCat(cat.id)}
                      loading={eliminandoId === cat.id}
                      className="py-1 px-2.5 sm:py-2  bg-redCustom/90 hover:bg-redCustom text-xs "
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
                              <Button variant="secondary" onClick={() => abrirEditarSub(sub)} className="py-1 px-2.5 !text-[10px] ">
                                Editar
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => eliminarSub(sub.id)}
                                loading={eliminandoId === sub.id}
                                className="py-1 px-2.5 !text-[10px] bg-redCustom/90 hover:!bg-redCustom "
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
