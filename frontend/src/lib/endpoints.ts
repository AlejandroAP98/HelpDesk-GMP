import { api } from "@/lib/api";
import type { Usuario } from "@/store/authStore";

export type EstadoTicket = "abierto" | "asignado" | "en_progreso" | "resuelto" | "cerrado";
export type PrioridadTicket = "baja" | "media" | "alta" | "urgente";
export type VistaTicket = "activos" | "historial" | "todos";
export type ElementoInfraestructura = "torre" | "celda" | "mastil" | "punto_venta";

export interface Ticket {
  id: string;
  empresa_id: number;
  empresa_nombre?: string | null;
  cliente_id: string;
  agente_id: string | null;
  modificado_por_id: string | null;
  modificado_por_nombre: string | null;
  categoria_id: number;
  subcategoria_id: number;
  elemento_afectado: ElementoInfraestructura;
  titulo: string;
  descripcion: string;
  ip_pcs: string | null;
  ip_antena: string | null;
  mascara_red: string | null;
  puerta_enlace: string | null;
  nombre_punto: string | null;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_asignacion?: string | null;
  fecha_primera_respuesta?: string | null;
  fecha_resolucion?: string | null;
  subcategoria_nombre?: string | null;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Comentario {
  id: string;
  ticket_id: string;
  usuario_id: string;
  usuario_nombre: string | null;
  contenido: string;
  es_nota_interna: boolean;
  fecha_creacion: string;
}

export interface Adjunto {
  id: string;
  ticket_id: string;
  comentario_id: string | null;
  archivo_url: string;
  nombre_archivo: string;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  fecha_creacion: string;
}

export interface HistorialEstado {
  id: string;
  ticket_id: string;
  usuario_id: string;
  usuario_nombre: string | null;
  estado_anterior: EstadoTicket;
  estado_nuevo: EstadoTicket;
  fecha: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  fecha_creacion: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface Subcategoria {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
}

export interface MatrizPrioridadEntry {
  id: number;
  categoria_id: number;
  subcategoria_id: number;
  elemento: ElementoInfraestructura;
  prioridad: PrioridadTicket;
}

export interface MatrizPrioridadBulkItem {
  subcategoria_id: number;
  elemento: ElementoInfraestructura;
  prioridad: PrioridadTicket;
}

export interface Stats {
  total: number;
  abiertos: number;
  asignados: number;
  en_progreso: number;
  resueltos: number;
  cerrados: number;
  urgentes: number;
}

export interface MetricasTiempos {
  mttr_horas: number | null;
  tiempo_primera_respuesta_minutos: number | null;
  tickets_resueltos_analizados: number;
  tickets_con_primera_respuesta: number;
}

export interface ConteoPorEstado {
  estado: string;
  cantidad: number;
}

export interface ConteoPorPrioridad {
  prioridad: string;
  cantidad: number;
}

export interface VolumenPorEmpresa {
  empresa_id: number;
  empresa_nombre: string | null;
  cantidad: number;
}

export interface MetricasVolumen {
  por_estado: ConteoPorEstado[];
  por_prioridad: ConteoPorPrioridad[];
  top_empresas: VolumenPorEmpresa[];
}

export interface DesgloseElemento {
  elemento: string;
  cantidad: number;
  porcentaje: number;
}

export interface TopUbicacion {
  nombre_punto: string;
  cantidad: number;
}

export interface MetricasInfraestructura {
  por_elemento: DesgloseElemento[];
  top_ubicaciones: TopUbicacion[];
}

export interface RendimientoAgente {
  agente_id: string;
  agente_nombre: string | null;
  asignados: number;
  resueltos: number;
  cerrados: number;
}

export interface MetricasRendimiento {
  por_agente: RendimientoAgente[];
}

export interface TiempoResolucionAgente {
  agente_id: string;
  agente_nombre: string | null;
  mttr_horas: number | null;
  tickets_analizados: number;
}

export interface MetricasTiempoPorAgente {
  por_agente: TiempoResolucionAgente[];
}

export interface ReaperturaItem {
  ticket_id: string;
  titulo: string;
  agente_nombre: string | null;
  fecha_reapertura: string;
  veces_reabierto: number;
}

export interface MetricasReaperturas {
  total_reaperturas: number;
  tickets: ReaperturaItem[];
}

export interface SLAItem {
  empresa_id: number;
  empresa_nombre: string | null;
  total_tickets: number;
  tickets_en_sla: number;
  porcentaje_sla: number;
  frt_horas: number | null;
  mttr_horas: number | null;
  total_tickets_mes_anterior: number | null;
  porcentaje_sla_mes_anterior: number | null;
  frt_horas_mes_anterior: number | null;
  mttr_horas_mes_anterior: number | null;
}

export interface MetricasSLA {
  sla_objetivo_frt_horas: number;
  sla_objetivo_mttr_horas: number;
  por_empresa: SLAItem[];
}

export const authApi = {
  login: async (email: string, password: string) => {
    const r = await api.post("/api/auth/login", { email, password });
    return r.data as { access_token: string; refresh_token: string; usuario: Usuario };
  },
  me: async () => {
    const r = await api.get("/api/auth/me");
    return r.data as Usuario;
  },
  register: async (data: { nombre: string; email: string; password: string; empresa_id: number }) => {
    const r = await api.post("/api/auth/register", data);
    return r.data as { access_token: string; refresh_token: string; usuario: Usuario };
  },
};

export const preferencesApi = {
  update: async (data: { notificaciones_email: boolean }) => {
    const r = await api.patch("/api/auth/preferences", data);
    return r.data as Usuario;
  },
};

export const ticketApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/tickets", { params });
    return r.data as Pagina<Ticket>;
  },
  obtener: async (id: string) => {
    const r = await api.get(`/api/tickets/${id}`);
    return r.data as Ticket;
  },
  crear: async (data: { titulo: string; descripcion: string; categoria_id: number; subcategoria_id: number; elemento_afectado: ElementoInfraestructura; ip_pcs?: string | null; ip_antena?: string | null; mascara_red?: string | null; puerta_enlace?: string | null; nombre_punto?: string | null }) => {
    const r = await api.post("/api/tickets", data);
    return r.data as Ticket;
  },
  asignar: async (id: string, agente_id: string) => {
    const r = await api.post(`/api/tickets/${id}/asignar`, { agente_id });
    return r.data as Ticket;
  },
  asignarme: async (id: string) => {
    const r = await api.post(`/api/tickets/${id}/asignarme`);
    return r.data as Ticket;
  },
  cambiarEstado: async (id: string, estado: EstadoTicket) => {
    const r = await api.patch(`/api/tickets/${id}/estado`, { estado });
    return r.data as Ticket;
  },
  cambiarPrioridad: async (id: string, prioridad: PrioridadTicket) => {
    const r = await api.patch(`/api/tickets/${id}/prioridad`, { prioridad });
    return r.data as Ticket;
  },
  cerrar: async (id: string) => {
    const r = await api.post(`/api/tickets/${id}/cerrar`);
    return r.data as Ticket;
  },
  reabrir: async (id: string) => {
    const r = await api.post(`/api/tickets/${id}/reabrir`);
    return r.data as Ticket;
  },
  historial: async (id: string, params: Record<string, unknown> = {}) => {
    const r = await api.get(`/api/tickets/${id}/historial`, { params });
    return r.data as Pagina<HistorialEstado>;
  },
};

export const comentarioApi = {
  listar: async (ticketId: string, params: Record<string, unknown> = {}) => {
    const r = await api.get(`/api/tickets/${ticketId}/comentarios`, { params });
    return r.data as Pagina<Comentario>;
  },
  crear: async (ticketId: string, data: { contenido: string; es_nota_interna?: boolean }) => {
    const r = await api.post(`/api/tickets/${ticketId}/comentarios`, data);
    return r.data as Comentario;
  },
};

export const adjuntoApi = {
  listar: async (ticketId: string, params: Record<string, unknown> = {}) => {
    const r = await api.get(`/api/tickets/${ticketId}/adjuntos`, { params });
    return r.data as Pagina<Adjunto>;
  },
  subir: async (ticketId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await api.post(`/api/tickets/${ticketId}/adjuntos`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data as Adjunto;
  },
  eliminar: async (ticketId: string, adjuntoId: string) => {
    const r = await api.delete(`/api/tickets/${ticketId}/adjuntos/${adjuntoId}`);
    return r.data;
  },
};

export const categoriaApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/categorias", { params });
    return r.data as Pagina<Categoria>;
  },
  obtener: async (id: number) => {
    const r = await api.get(`/api/categorias/${id}`);
    return r.data as Categoria;
  },
  crear: async (data: { nombre: string; descripcion?: string }) => {
    const r = await api.post("/api/categorias", data);
    return r.data as Categoria;
  },
  actualizar: async (id: number, data: { nombre?: string; descripcion?: string }) => {
    const r = await api.patch(`/api/categorias/${id}`, data);
    return r.data as Categoria;
  },
  eliminar: async (id: number) => {
    const r = await api.delete(`/api/categorias/${id}`);
    return r.data;
  },
};

export const subcategoriaApi = {
  listarPorCategoria: async (categoriaId: number, params: Record<string, unknown> = {}) => {
    const r = await api.get(`/api/subcategorias/por-categoria/${categoriaId}`, { params });
    return r.data as Pagina<Subcategoria>;
  },
  obtener: async (id: number) => {
    const r = await api.get(`/api/subcategorias/${id}`);
    return r.data as Subcategoria;
  },
  crear: async (data: { categoria_id: number; nombre: string; descripcion?: string }) => {
    const r = await api.post("/api/subcategorias", data);
    return r.data as Subcategoria;
  },
  actualizar: async (id: number, data: { nombre?: string; descripcion?: string }) => {
    const r = await api.patch(`/api/subcategorias/${id}`, data);
    return r.data as Subcategoria;
  },
  eliminar: async (id: number) => {
    const r = await api.delete(`/api/subcategorias/${id}`);
    return r.data;
  },
};

export const matrizPrioridadApi = {
  listarPorCategoria: async (categoriaId: number) => {
    const r = await api.get(`/api/matriz-prioridad/por-categoria/${categoriaId}`);
    return r.data as MatrizPrioridadEntry[];
  },
  sincronizarCategoria: async (categoriaId: number, items: MatrizPrioridadBulkItem[]) => {
    const r = await api.put(`/api/matriz-prioridad/categoria/${categoriaId}`, { items });
    return r.data as MatrizPrioridadEntry[];
  },
};

export const statsApi = {
  obtener: async () => {
    const r = await api.get("/api/stats");
    return r.data as Stats;
  },
};

export const empresaApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/empresas", { params });
    return r.data as Pagina<Empresa>;
  },
  obtener: async (id: number) => {
    const r = await api.get(`/api/empresas/${id}`);
    return r.data as Empresa;
  },
  crear: async (data: { nombre: string }) => {
    const r = await api.post("/api/empresas", data);
    return r.data as Empresa;
  },
  actualizar: async (id: number, data: { nombre?: string }) => {
    const r = await api.patch(`/api/empresas/${id}`, data);
    return r.data as Empresa;
  },
  eliminar: async (id: number) => {
    const r = await api.delete(`/api/empresas/${id}`);
    return r.data;
  },
};

export const adminApi = {
  listarUsuarios: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/usuarios", { params });
    return r.data as Pagina<Usuario>;
  },
  obtenerUsuario: async (id: string) => {
    const r = await api.get(`/api/usuarios/${id}`);
    return r.data as Usuario;
  },
  actualizarUsuario: async (id: string, data: { nombre?: string; email?: string; rol?: string; empresa_id?: number; password?: string }) => {
    const r = await api.patch(`/api/usuarios/${id}`, data);
    return r.data as Usuario;
  },
  eliminarUsuario: async (id: string) => {
    const r = await api.delete(`/api/usuarios/${id}`);
    return r.data;
  },
  crearUsuario: async (data: { nombre: string; email: string; password: string; rol: string; empresa_id?: number | null }) => {
    const r = await api.post("/api/auth/register/agente", {
      nombre: data.nombre,
      email: data.email,
      password: data.password,
      rol: data.rol,
      empresa_id: data.empresa_id ?? null,
    });
    return r.data as { access_token: string; refresh_token: string; usuario: Usuario };
  },
  crearAgente: async (data: { nombre: string; email: string; password: string; empresa_id?: number | null }) => {
    const r = await api.post("/api/auth/register/agente", data);
    return r.data as { access_token: string; refresh_token: string; usuario: Usuario };
  },
  listarEmpresas: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/empresas", { params });
    return r.data as Pagina<Empresa>;
  },
};

export interface PushSubscriptionOut {
  id: string;
  endpoint: string;
  plataforma: "web" | "ios" | "android";
  user_agent: string | null;
  fecha_creacion: string;
}

export interface PushSubscribeInput {
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  plataforma: "web" | "ios" | "android";
  user_agent: string | null;
}

export interface TareaPendiente {
  id: string;
  usuario_id: string;
  texto: string;
  completada: boolean;
  ticket_id: string | null;
  ticket_titulo: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export const tareaApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/tareas", { params });
    return r.data as Pagina<TareaPendiente>;
  },
  crear: async (data: { texto: string; ticket_id?: string | null }) => {
    const r = await api.post("/api/tareas", data);
    return r.data as TareaPendiente;
  },
  actualizar: async (id: string, data: { texto?: string; completada?: boolean }) => {
    const r = await api.patch(`/api/tareas/${id}`, data);
    return r.data as TareaPendiente;
  },
  eliminar: async (id: string) => {
    await api.delete(`/api/tareas/${id}`);
  },
};

export interface PuntoVenta {
  id: number;
  empresa_id: number;
  empresa_nombre?: string | null;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  activo: boolean;
}

export const puntoVentaApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/puntos-venta", { params });
    return r.data as Pagina<PuntoVenta>;
  },
  listarPorEmpresa: async (empresaId: number) => {
    const r = await api.get(`/api/puntos-venta/por-empresa/${empresaId}`, {
      params: { solo_activos: true },
    });
    return r.data as PuntoVenta[];
  },
  crear: async (data: { empresa_id: number; nombre: string; direccion?: string; ciudad?: string }) => {
    const r = await api.post("/api/puntos-venta", data);
    return r.data as PuntoVenta;
  },
  actualizar: async (id: number, data: { nombre?: string; direccion?: string; ciudad?: string; activo?: boolean }) => {
    const r = await api.patch(`/api/puntos-venta/${id}`, data);
    return r.data as PuntoVenta;
  },
  eliminar: async (id: number) => {
    await api.delete(`/api/puntos-venta/${id}`);
  },
};

export const pushApi = {
  getVapidKey: async () => {
    const r = await api.get("/api/push/vapid-public-key");
    return r.data as { public_key: string };
  },
  listMySubscriptions: async () => {
    const r = await api.get("/api/push/subscriptions");
    return r.data as PushSubscriptionOut[];
  },
  subscribe: async (data: PushSubscribeInput) => {
    const r = await api.post("/api/push/subscribe", data);
    return r.data as PushSubscriptionOut;
  },
  unsubscribe: async (endpoint: string) => {
    await api.delete("/api/push/subscribe", { data: { endpoint } });
  },
  unsubscribeAll: async () => {
    await api.delete("/api/push/subscriptions/all");
  },
  sendTest: async () => {
    const r = await api.post("/api/push/test");
    return r.data as { delivered: number };
  },
};

export const reportesApi = {
  descargarCSV: async (params: Record<string, string> = {}) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    const token = (await import("@/store/authStore")).useAuthStore.getState().token;
    const query = new URLSearchParams(params).toString();
    const url = `${base}/api/reportes/tickets/csv${query ? `?${query}` : ""}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Error al descargar reporte");
    const blob = await r.blob();
    const disposition = r.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match?.[1] || "reporte_tickets.csv";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

export interface RespuestaRapida {
  id: string;
  usuario_id: string;
  titulo: string;
  contenido: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export const respuestaRapidaApi = {
  listar: async () => {
    const r = await api.get("/api/respuestas-rapidas");
    return r.data as RespuestaRapida[];
  },
  crear: async (data: { titulo: string; contenido: string }) => {
    const r = await api.post("/api/respuestas-rapidas", data);
    return r.data as RespuestaRapida;
  },
  actualizar: async (id: string, data: { titulo?: string; contenido?: string }) => {
    const r = await api.put(`/api/respuestas-rapidas/${id}`, data);
    return r.data as RespuestaRapida;
  },
  eliminar: async (id: string) => {
    await api.delete(`/api/respuestas-rapidas/${id}`);
  },
};

export const metricasApi = {
  tiempos: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/tiempos", { params });
    return r.data as MetricasTiempos;
  },
  volumen: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/volumen", { params });
    return r.data as MetricasVolumen;
  },
  infraestructura: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/infraestructura", { params });
    return r.data as MetricasInfraestructura;
  },
  rendimientoAgente: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/rendimiento-agente", { params });
    return r.data as MetricasRendimiento;
  },
  tiempoPorAgente: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/tiempo-por-agente", { params });
    return r.data as MetricasTiempoPorAgente;
  },
  reaperturas: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/reaperturas", { params });
    return r.data as MetricasReaperturas;
  },
  sla: async (params: Record<string, string> = {}) => {
    const r = await api.get("/api/metricas/sla", { params });
    return r.data as MetricasSLA;
  },
};