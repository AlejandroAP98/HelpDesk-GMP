"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useWsTicketStore } from "@/store/wsTicketStore";
import {
  adjuntoApi,
  comentarioApi,
  ticketApi,
  adminApi,
  type Adjunto,
  type Comentario,
  type EstadoTicket,
  type HistorialEstado,
  type PrioridadTicket,
  type Ticket,
} from "@/lib/endpoints";
import { optimizeImage } from "@/lib/imageUtils";
import type { Usuario } from "@/store/authStore";

export type AccionTicket =
  | "asignarme"
  | "cambiar_estado"
  | "cerrar"
  | "reabrir"
  | "prioridad"
  | "reasignar"
  | "pausar"
  | "reanudar"
  | null;

export function useTicketDetail(ticketId: string) {
  const usuario = useAuthStore((s) => s.usuario);
  const setOnTicketUpdated = useWsTicketStore((s) => s.setOnTicketUpdated);
  const setOnTicketCommented = useWsTicketStore((s) => s.setOnTicketCommented);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [historial, setHistorial] = useState<HistorialEstado[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [esNotaInterna, setEsNotaInterna] = useState(false);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comentariosPage, setComentariosPage] = useState(1);
  const [comentariosTotalPages, setComentariosTotalPages] = useState(1);
  const [adjuntosPage, setAdjuntosPage] = useState(1);
  const [adjuntosTotalPages, setAdjuntosTotalPages] = useState(1);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialTotalPages, setHistorialTotalPages] = useState(1);
  const [agentes, setAgentes] = useState<Usuario[]>([]);
  const [agenteSel, setAgenteSel] = useState<string>("");
  const [reasignando, setReasignando] = useState(false);
  const [campoCopiado, setCampoCopiado] = useState<string | null>(null);
  const [comentando, setComentando] = useState(false);
  const [accion, setAccion] = useState<AccionTicket>(null);
  const busyRef = useRef(false);

  const handleCopiar = useCallback((campo: string, valor: string) => {
    navigator.clipboard.writeText(valor);
    setCampoCopiado(campo);
    setTimeout(() => setCampoCopiado(null), 1500);
  }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [t, cs, as, hs] = await Promise.all([
        ticketApi.obtener(ticketId),
        comentarioApi.listar(ticketId, { page: 1, size: 20 }),
        adjuntoApi.listar(ticketId, { page: 1, size: 20 }),
        ticketApi.historial(ticketId, { page: 1, size: 20 }),
      ]);
      setTicket(t);
      setComentarios(cs.items);
      setComentariosTotalPages(cs.pages);
      setComentariosPage(1);
      setAdjuntos(as.items);
      setAdjuntosTotalPages(as.pages);
      setAdjuntosPage(1);
      setHistorial(hs.items);
      setHistorialTotalPages(hs.pages);
      setHistorialPage(1);
    } catch {
      setError("No se pudo cargar el ticket");
    } finally {
      setCargando(false);
    }
  }, [ticketId]);

  const cargarMasComentarios = async () => {
    const nextPage = comentariosPage + 1;
    if (nextPage > comentariosTotalPages) return;
    try {
      const data = await comentarioApi.listar(ticketId, { page: nextPage, size: 20 });
      setComentarios((prev) => [...prev, ...data.items]);
      setComentariosPage(nextPage);
      setComentariosTotalPages(data.pages);
    } catch {
      console.error("No se pudo cargar mas comentarios");
    }
  };

  const cargarMasAdjuntos = async () => {
    const nextPage = adjuntosPage + 1;
    if (nextPage > adjuntosTotalPages) return;
    try {
      const data = await adjuntoApi.listar(ticketId, { page: nextPage, size: 20 });
      setAdjuntos((prev) => [...prev, ...data.items]);
      setAdjuntosPage(nextPage);
      setAdjuntosTotalPages(data.pages);
    } catch {
      console.error("No se pudo cargar mas adjuntos");
    }
  };

  const cargarMasHistorial = async () => {
    const nextPage = historialPage + 1;
    if (nextPage > historialTotalPages) return;
    try {
      const data = await ticketApi.historial(ticketId, { page: nextPage, size: 20 });
      setHistorial((prev) => [...prev, ...data.items]);
      setHistorialPage(nextPage);
      setHistorialTotalPages(data.pages);
    } catch {
      console.error("No se pudo cargar mas historial");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if ((usuario?.rol === "administrador" || usuario?.rol === "mesa_ayuda") && ticket?.agente_id) {
      Promise.all([
        adminApi.listarUsuarios({ rol: "agente", size: 100, activo: true }),
        adminApi.listarUsuarios({ rol: "mesa_ayuda", size: 100, activo: true }),
      ]).then(([agentes, mesas]) => {
        setAgentes([...agentes.items, ...mesas.items]);
      }).catch(() => {});
    }
  }, [usuario?.rol, ticket?.agente_id]);

  useEffect(() => {
    setOnTicketUpdated((ev) => {
      if (ev.ticket_id === ticketId) {
        setTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            estado: ev.estado as EstadoTicket,
            prioridad: ev.prioridad as PrioridadTicket,
            agente_id: ev.agente_id,
            fecha_actualizacion: ev.fecha_actualizacion,
          };
        });
      }
    });

    setOnTicketCommented((ev) => {
      if (ev.ticket_id !== ticketId) return;
      if (ev.es_nota_interna && usuario?.rol === "cliente") return;
      setComentarios((prev) => {
        const existe = prev.some((c) => c.id === ev.comentario_id);
        if (existe) return prev;
        return [
          ...prev,
          {
            id: ev.comentario_id,
            ticket_id: ev.ticket_id,
            usuario_id: ev.usuario_id,
            usuario_nombre: ev.usuario_nombre,
            contenido: ev.contenido,
            es_nota_interna: ev.es_nota_interna,
            fecha_creacion: ev.fecha_creacion,
            adjuntos: ev.adjuntos ?? [],
          },
        ];
      });
    });

    return () => {
      setOnTicketUpdated(null);
      setOnTicketCommented(null);
    };
  }, [ticketId, usuario?.rol, setOnTicketUpdated, setOnTicketCommented]);

  const agregarArchivos = useCallback((files: FileList | null) => {
    if (!files) return;
    const nuevos = Array.from(files);
    setArchivosSeleccionados((prev) => [...prev, ...nuevos]);
  }, []);

  const quitarArchivo = useCallback((index: number) => {
    setArchivosSeleccionados((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const enviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const tieneTexto = nuevoComentario.trim().length > 0;
    const tieneArchivos = archivosSeleccionados.length > 0;
    if (!tieneTexto && !tieneArchivos) return;
    busyRef.current = true;
    setComentando(true);
    try {
      const optimizados = await Promise.all(
        archivosSeleccionados.map((f) => optimizeImage(f))
      );
      const form = new FormData();
      if (tieneTexto) form.append("contenido", nuevoComentario.trim());
      form.append("es_nota_interna", String(esNotaInterna));
      optimizados.forEach((f) => form.append("files", f));
      await comentarioApi.crear(ticketId, form);
      setNuevoComentario("");
      setEsNotaInterna(false);
      setArchivosSeleccionados([]);
      await cargar();
    } catch {
      setError("No se pudo agregar el comentario");
    } finally {
      busyRef.current = false;
      setComentando(false);
    }
  };

  const cambiarEstado = async (estado: EstadoTicket) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("cambiar_estado");
    try {
      await ticketApi.cambiarEstado(ticketId, estado);
      await cargar();
    } catch {
      setError("Transicion invalida");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const cerrar = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("cerrar");
    try {
      await ticketApi.cerrar(ticketId);
      await cargar();
    } catch {
      setError("No se pudo cerrar el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const reabrir = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("reabrir");
    try {
      await ticketApi.reabrir(ticketId);
      await cargar();
    } catch {
      setError("No se pudo reabrir el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const asignarme = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("asignarme");
    try {
      await ticketApi.asignarme(ticketId);
      await cargar();
    } catch {
      setError("No se pudo autoasignar el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const reasignar = async () => {
    if (!agenteSel || busyRef.current) return;
    busyRef.current = true;
    setAccion("reasignar");
    setReasignando(true);
    setError(null);
    try {
      await ticketApi.asignar(ticketId, agenteSel);
      setAgenteSel("");
      await cargar();
    } catch {
      setError("No se pudo reasignar el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
      setReasignando(false);
    }
  };

  const setPrioridad = async (p: PrioridadTicket) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("prioridad");
    try {
      await ticketApi.cambiarPrioridad(ticketId, p);
      await cargar();
    } catch {
      setError("No se pudo cambiar prioridad");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const pausar = async (motivo: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("pausar");
    try {
      await ticketApi.pausar(ticketId, motivo);
      await cargar();
    } catch {
      setError("No se pudo pausar el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  const reanudar = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setAccion("reanudar");
    try {
      await ticketApi.reanudar(ticketId);
      await cargar();
    } catch {
      setError("No se pudo reanudar el ticket");
    } finally {
      busyRef.current = false;
      setAccion(null);
    }
  };

  return {
    ticket, comentarios, adjuntos, historial,
    nuevoComentario, setNuevoComentario,
    esNotaInterna, setEsNotaInterna,
    archivosSeleccionados, agregarArchivos, quitarArchivo,
    cargando, error, setError,
    comentando, accion,
    comentariosPage, comentariosTotalPages, cargarMasComentarios,
    adjuntosPage, adjuntosTotalPages, cargarMasAdjuntos,
    historialPage, historialTotalPages, cargarMasHistorial,
    agentes, agenteSel, setAgenteSel, reasignando, reasignar,
    handleCopiar, campoCopiado,
    enviarComentario, cambiarEstado, cerrar, reabrir, asignarme, setPrioridad, pausar, reanudar, cargar,
  };
}
