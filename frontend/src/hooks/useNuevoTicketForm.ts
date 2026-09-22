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

export type CampoRedKey = "ip_pcs" | "ip_antena" | "mascara_red" | "puerta_enlace";

export function useNuevoTicketForm() {
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const hasRole = useAuthStore((s) => s.hasRole);
  const esStaff = hasRole("administrador", "mesa_ayuda");

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
      const puntoVentaSeleccionado =
        elemento === "punto_venta"
          ? puntosVenta.find((pv) => pv.id === puntoVentaId) ?? null
          : null;
      const nombrePunto = puntoVentaSeleccionado?.nombre ?? null;
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
        punto_venta_id: puntoVentaSeleccionado?.id ?? null,
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

  return {
    usuario, esStaff,
    categorias, subcategorias, categoriaId, setCategoriaId,
    subcategoriaId, setSubcategoriaId, elemento, setElemento,
    titulo, setTitulo, descripcion, setDescripcion,
    camposActivos, toggleCampo, valoresCampos, setValorCampo,
    empresas, clientes, empresaId, setEmpresaId, clienteId, setClienteId,
    puntosVenta, puntoVentaId, setPuntoVentaId,
    error, enviando, submit, cancelar: () => router.back(),
  };
}
