"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  categoriaApi,
  subcategoriaApi,
  ticketApi,
  puntoVentaApi,
  empresaApi,
  adminApi,
  type Categoria,
  type Subcategoria,
  type ElementoInfraestructura,
  type PuntoVenta,
  type Empresa,
} from "@/lib/endpoints";
import { useAuthStore, type Usuario } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { PageHeader } from "@/components/ui/PageHeader";
import NewTicketIcon from "@/app/assets/icons/NewTicketIcon";

const ELEMENTOS: { value: ElementoInfraestructura; label: string }[] = [
  { value: "torre", label: "Torre" },
  { value: "celda", label: "Celda" },
  { value: "mastil", label: "Mástil" },
  { value: "punto_venta", label: "Punto de venta" },
];

const CAMPOS_RED = [
  { key: "ip_pcs", label: "IP's PC's", placeholder: "Ej: 192.168.1.10, 192.168.1.11" },
  { key: "ip_antena", label: "IP Antena", placeholder: "Ej: 10.0.0.1" },
  { key: "mascara_red", label: "Máscara de red", placeholder: "Ej: 255.255.255.0" },
  { key: "puerta_enlace", label: "Puerta de enlace", placeholder: "Ej: 192.168.1.1" },
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
  });
  const [valoresCampos, setValoresCampos] = useState<Record<CampoRedKey, string>>({
    ip_pcs: "",
    ip_antena: "",
    mascara_red: "",
    puerta_enlace: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([]);
  const [puntoVentaId, setPuntoVentaId] = useState<number | null>(null);
  const usuario = useAuthStore((s) => s.usuario);
  const hasRole = useAuthStore((s) => s.hasRole);
  const esStaff = hasRole("administrador", "mesa_ayuda");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clientes, setClientes] = useState<Usuario[]>([]);
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  useEffect(() => {
    categoriaApi.listar().then((r) => setCategorias(r.items)).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (esStaff) {
      empresaApi
        .listar({ size: 100 })
        .then((r) => setEmpresas(r.items))
        .catch(() => setEmpresas([]));
    }
  }, [esStaff]);

  useEffect(() => {
    setClienteId(null);
    if (esStaff && empresaId) {
      adminApi
        .listarUsuarios({ empresa_id: empresaId, rol: "cliente", size: 100 })
        .then((r) => setClientes(r.items))
        .catch(() => setClientes([]));
    } else {
      setClientes([]);
    }
  }, [esStaff, empresaId]);

  useEffect(() => {
    if (categoriaId) {
      subcategoriaApi
        .listarPorCategoria(categoriaId)
        .then((r) => setSubcategorias(r.items))
        .catch(() => setSubcategorias([]));
    } else {
      setSubcategorias([]);
    }
    setSubcategoriaId(null);
    setElemento(null);
  }, [categoriaId]);

  useEffect(() => {
    const empresaEfectiva = esStaff ? empresaId : usuario?.empresa_id;
    if (elemento === "punto_venta" && empresaEfectiva) {
      puntoVentaApi
        .listarPorEmpresa(empresaEfectiva)
        .then((r) => setPuntosVenta(r))
        .catch(() => setPuntosVenta([]));
    } else {
      setPuntosVenta([]);
    }
    setPuntoVentaId(null);
  }, [elemento, esStaff, empresaId, usuario?.empresa_id]);

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
    if (esStaff && !empresaId) {
      setError("Seleccione la empresa");
      return;
    }
    if (esStaff && !clienteId) {
      setError("Seleccione el cliente a nombre de quien se crea el ticket");
      return;
    }
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
      const nombrePunto = elemento === "punto_venta" && puntoVentaId
        ? puntosVenta.find((pv) => pv.id === puntoVentaId)?.nombre ?? null
        : null;
      const base = {
        titulo,
        descripcion,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        elemento_afectado: elemento,
        ip_pcs: camposActivos.ip_pcs ? valoresCampos.ip_pcs || null : null,
        ip_antena: camposActivos.ip_antena ? valoresCampos.ip_antena || null : null,
        mascara_red: camposActivos.mascara_red ? valoresCampos.mascara_red || null : null,
        puerta_enlace: camposActivos.puerta_enlace ? valoresCampos.puerta_enlace || null : null,
        nombre_punto: nombrePunto,
      };
      if (esStaff && empresaId && clienteId) {
        await ticketApi.crearAdmin({ ...base, empresa_id: empresaId, cliente_id: clienteId });
      } else {
        await ticketApi.crear(base);
      }
      router.replace("/tickets");
    } catch {
      setError("Error al crear el ticket");
      setEnviando(false);
    }
  };

  return (
    <div className="animate-scale-in max-w-4xl mx-auto">
      <PageHeader
        title="Nuevo Ticket"
        subtitle="Completa el siguiente formulario de la forma más detallada posible para crear un nuevo ticket."
      />
      <form onSubmit={submit} className="space-y-5 mt-4">
        <Card >
          {esStaff && (
            <div className="grid grid-cols-2 gap-4 mt-5 mb-4 border-b border-gray-100 pb-4">
              <Select
                label="Empresa"
                value={empresaId ?? ""}
                onChange={(e) => setEmpresaId(Number(e.target.value) || null)}
                placeholder="Seleccione..."
                options={empresas.map((emp) => ({ value: String(emp.id), label: emp.nombre }))}
              />
              <div className="flex flex-col">
                <span className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
                  Cliente
                </span>
                <SearchableSelect
                  value={clienteId}
                  onChange={(v) => setClienteId(v || null)}
                  placeholder={empresaId ? "Buscar cliente..." : "Seleccione una empresa primero"}
                  emptyMessage="No se encontraron clientes"
                  disabled={!empresaId}
                  options={clientes.map((cl) => ({
                    value: cl.id,
                    label: cl.nombre,
                    sublabel: cl.email,
                  }))}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 items-start mb-4 ">
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
              label="Infraestructura"
              value={elemento ?? ""}
              onChange={(e) => setElemento((e.target.value as ElementoInfraestructura) || null)}
              placeholder="Seleccione..."
              disabled={!subcategoriaId}
              options={ELEMENTOS.map((el) => ({ value: el.value, label: el.label }))}
            />
            {elemento === "punto_venta" && (
              <div className="flex flex-col gap-1">
                <span className="sm:text-[11px] text-[10px] px-1 font-medium text-gray-500 uppercase tracking-normal">
                  Punto de venta
                </span>
                <SearchableSelect
                  value={puntoVentaId}
                  onChange={(v) => setPuntoVentaId(Number(v) || null)}
                  placeholder="Buscar punto de venta..."
                  emptyMessage="No se encontraron puntos de venta"
                  options={puntosVenta.map((pv) => ({
                    value: String(pv.id),
                    label: pv.nombre,
                    sublabel: pv.ciudad ?? undefined,
                  }))}
                />
              </div>
            )}
          </div>
          <div className="mb-4 border-b border-gray-200 pb-4">
          </div>
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
          <section className="mt-5 border border-gray-200 rounded-xl p-4">
            <span className="sm:text-xs text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3 block">
            Información de red (opcional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPOS_RED.map((campo) => (
              <div key={campo.key} className="flex items-center gap-3 h-6">
                <input
                  type="checkbox"
                  id={campo.key}
                  checked={camposActivos[campo.key]}
                  onChange={() => toggleCampo(campo.key)}
                  className="w-4 h-4 rounded sm:text-xs text-[10px] border-gray-300 text-brand-600 focus:ring-brandCustom"
                />
                <div className="flex gap-4 w-full">
                  <label htmlFor={campo.key} className="text-nowrap self-center sm:text-xs text-[10px] font-normal text-gray-600 cursor-pointer select-none">
                    {campo.label}
                  </label>
                  {camposActivos[campo.key] && (
                    <input
                      type="text"
                      value={valoresCampos[campo.key]}
                      onChange={(e) => setValorCampo(campo.key, e.target.value)}
                      placeholder={campo.placeholder}
                      className="w-auto rounded-lg text-nowrap border border-gray-200 bg-gray-50 px-3 py-1.5 sm:text-xs text-[11px] text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brandCustom focus:bg-white outline-none transition-all"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          </section>
          <div className="flex gap-3 justify-end mt-5">
            <Button type="submit" loading={enviando} icon={<NewTicketIcon />}>
              {!enviando ? "Crear ticket" : "Creando..."}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        {error && <ErrorMessage message={error} />}
        </Card>
      </form>
    </div>
  );
}
