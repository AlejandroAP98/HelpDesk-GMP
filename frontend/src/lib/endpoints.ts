import { api } from "@/lib/api";
import type { Usuario } from "@/store/authStore";

export type EstadoTicket = "abierto" | "asignado" | "en_progreso" | "resuelto" | "cerrado";
export type PrioridadTicket = "baja" | "media" | "alta" | "urgente";

export interface Ticket {
  id: string;
  empresa_id: number;
  cliente_id: string;
  agente_id: string | null;
  categoria_id: number;
  titulo: string;
  descripcion: string;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  fecha_creacion: string;
  fecha_actualizacion: string;
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

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
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

export const ticketApi = {
  listar: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/tickets", { params });
    return r.data as Pagina<Ticket>;
  },
  obtener: async (id: string) => {
    const r = await api.get(`/api/tickets/${id}`);
    return r.data as Ticket;
  },
  crear: async (data: { titulo: string; descripcion: string; categoria_id: number; prioridad: PrioridadTicket }) => {
    const r = await api.post("/api/tickets", data);
    return r.data as Ticket;
  },
  asignar: async (id: string, agente_id: string) => {
    const r = await api.post(`/api/tickets/${id}/asignar`, { agente_id });
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
};

export const comentarioApi = {
  listar: async (ticketId: string) => {
    const r = await api.get(`/api/tickets/${ticketId}/comentarios`);
    return r.data as Comentario[];
  },
  crear: async (ticketId: string, data: { contenido: string; es_nota_interna?: boolean }) => {
    const r = await api.post(`/api/tickets/${ticketId}/comentarios`, data);
    return r.data as Comentario;
  },
};

export const adjuntoApi = {
  listar: async (ticketId: string) => {
    const r = await api.get(`/api/tickets/${ticketId}/adjuntos`);
    return r.data as Adjunto[];
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
  listar: async () => {
    const r = await api.get("/api/categorias");
    return r.data as Categoria[];
  },
};

export const adminApi = {
  listarUsuarios: async (params: Record<string, unknown> = {}) => {
    const r = await api.get("/api/usuarios", { params });
    return r.data as Pagina<Usuario>;
  },
  listarEmpresas: async () => {
    const r = await api.get("/api/empresas");
    return r.data as Pagina<{ id: number; nombre: string; fecha_creacion: string }>;
  },
};