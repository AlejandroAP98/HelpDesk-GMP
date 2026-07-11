"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  categoriaApi,
  subcategoriaApi,
  ticketApi,
  type Categoria,
  type Subcategoria,
  type ElementoInfraestructura,
} from "@/lib/endpoints";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

const ELEMENTOS: { value: ElementoInfraestructura; label: string }[] = [
  { value: "torre", label: "Torre" },
  { value: "celda", label: "Celda" },
  { value: "mastil", label: "Mástil" },
  { value: "punto_venta", label: "Punto de venta" },
];

const CAMPOS_RED = [
  { key: "ip_pcs", label: "IP PC(s)", placeholder: "Ej: 192.168.1.10, 192.168.1.11" },
  { key: "ip_antena", label: "IP Antena", placeholder: "Ej: 10.0.0.1" },
  { key: "mascara_red", label: "Máscara de red", placeholder: "Ej: 255.255.255.0" },
  { key: "puerta_enlace", label: "Puerta de enlace", placeholder: "Ej: 192.168.1.1" },
  { key: "nombre_punto", label: "Nombre del punto", placeholder: "Ej: Sucursal Norte" },
] as const;

type CampoRedKey = (typeof CAMPOS_RED)[number]["key"];

export default function NuevoTicketPage() {
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [subcategoriaId, setSubcategoriaId] = useState<number | null>(null);
  const [elemento, setElemento] = useState<ElementoInfraestructura | null>(null);
  const [camposActivos, setCamposActivos] = useState<Record<CampoRedKey, boolean>>({
    ip_pcs: false,
    ip_antena: false,
    mascara_red: false,
    puerta_enlace: false,
    nombre_punto: false,
  });
  const [valoresCampos, setValoresCampos] = useState<Record<CampoRedKey, string>>({
    ip_pcs: "",
    ip_antena: "",
    mascara_red: "",
    puerta_enlace: "",
    nombre_punto: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    categoriaApi.listar().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (categoriaId) {
      subcategoriaApi
        .listarPorCategoria(categoriaId)
        .then(setSubcategorias)
        .catch(() => setSubcategorias([]));
    } else {
      setSubcategorias([]);
    }
    setSubcategoriaId(null);
    setElemento(null);
  }, [categoriaId]);

  const toggleCampo = (key: CampoRedKey) => {
    setCamposActivos((prev) => ({ ...prev, [key]: !prev[key] }));
    if (camposActivos[key]) {
      setValoresCampos((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const setValorCampo = (key: CampoRedKey, value: string) => {
    setValoresCampos((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoriaId) {
      setError("Seleccione una categoría");
      return;
    }
    if (!subcategoriaId) {
      setError("Seleccione una subcategoría");
      return;
    }
    if (!elemento) {
      setError("Seleccione el elemento de infraestructura afectado");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await ticketApi.crear({
        titulo,
        descripcion,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        elemento_afectado: elemento,
        ip_pcs: camposActivos.ip_pcs ? valoresCampos.ip_pcs || null : null,
        ip_antena: camposActivos.ip_antena ? valoresCampos.ip_antena || null : null,
        mascara_red: camposActivos.mascara_red ? valoresCampos.mascara_red || null : null,
        puerta_enlace: camposActivos.puerta_enlace ? valoresCampos.puerta_enlace || null : null,
        nombre_punto: camposActivos.nombre_punto ? valoresCampos.nombre_punto || null : null,
      });
      router.replace("/tickets");
    } catch {
      setError("Error al crear el ticket");
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Nuevo Ticket</h1>
      <form onSubmit={submit} className="space-y-5">
        <Card>
          <Input
            label="Titulo"
            type="text"
            required
            maxLength={150}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Escriba un titulo descriptivo"
          />

          <div className="mt-5">
            <Textarea
              label="Descripcion"
              required
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa el problema detalladamente"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <Select
              label="Categoría"
              value={categoriaId ?? ""}
              onChange={(e) => setCategoriaId(Number(e.target.value) || null)}
              placeholder="Seleccione..."
              options={categorias.map((c) => ({ value: String(c.id), label: c.nombre }))}
            />

            <Select
              label="Subcategoría"
              value={subcategoriaId ?? ""}
              onChange={(e) => setSubcategoriaId(Number(e.target.value) || null)}
              placeholder="Seleccione..."
              disabled={!categoriaId}
              options={subcategorias.map((s) => ({ value: String(s.id), label: s.nombre }))}
            />

            <Select
              label="Elemento de infraestructura"
              value={elemento ?? ""}
              onChange={(e) => setElemento((e.target.value as ElementoInfraestructura) || null)}
              placeholder="Seleccione..."
              disabled={!subcategoriaId}
              options={ELEMENTOS.map((el) => ({ value: el.value, label: el.label }))}
            />
          </div>
        </Card>

        <Card>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
            Información de red (opcional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPOS_RED.map((campo) => (
              <div key={campo.key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={campo.key}
                  checked={camposActivos[campo.key]}
                  onChange={() => toggleCampo(campo.key)}
                  className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brandCustom"
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor={campo.key} className="text-xs font-medium text-gray-600 cursor-pointer select-none">
                    {campo.label}
                  </label>
                  {camposActivos[campo.key] && (
                    <input
                      type="text"
                      value={valoresCampos[campo.key]}
                      onChange={(e) => setValorCampo(campo.key, e.target.value)}
                      placeholder={campo.placeholder}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brandCustom focus:bg-white outline-none transition-all"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {error && <ErrorMessage message={error} />}

        <div className="flex gap-3">
          <Button type="submit" loading={enviando}>
            Crear ticket
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
