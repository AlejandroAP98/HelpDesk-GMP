"use client";

import { create } from "zustand";

export interface TicketCreatedEvent {
  type: "ticket:created";
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
  cliente_id: string | null;
  agente_id: string | null;
  fecha_actualizacion: string;
}

export interface TicketUpdatedEvent {
  type: "ticket:updated";
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
  cliente_id: string | null;
  agente_id: string | null;
  fecha_actualizacion: string;
}

export interface TicketAssignedEvent {
  type: "ticket:assigned";
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
  cliente_id: string | null;
  agente_id: string | null;
  fecha_actualizacion: string;
}

export interface TicketCommentedEvent {
  type: "ticket:commented";
  ticket_id: string;
  comentario_id: string;
  usuario_id: string;
  usuario_nombre: string;
  contenido: string;
  es_nota_interna: boolean;
  fecha_creacion: string;
}

export interface TicketStateChangedEvent {
  type: "ticket:state_changed";
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
  estado_anterior: string;
  estado_nuevo: string;
  cliente_id: string | null;
  agente_id: string | null;
  fecha_actualizacion: string;
}

export type WsTicketEvent =
  | TicketCreatedEvent
  | TicketUpdatedEvent
  | TicketAssignedEvent
  | TicketCommentedEvent
  | TicketStateChangedEvent;

type Handler<T> = (ev: T) => void;

interface WsTicketStore {
  _send: ((payload: unknown) => boolean) | null;
  _pending: Set<string>;
  setSend: (fn: (payload: unknown) => boolean) => void;
  subscribeTicket: (ticketId: string) => void;
  unsubscribeTicket: (ticketId: string) => void;
  onTicketCreated: Handler<TicketCreatedEvent> | null;
  onTicketUpdated: Handler<TicketUpdatedEvent> | null;
  onTicketAssigned: Handler<TicketAssignedEvent> | null;
  onTicketCommented: Handler<TicketCommentedEvent> | null;
  onTicketStateChanged: Handler<TicketStateChangedEvent> | null;
  setOnTicketCreated: (h: Handler<TicketCreatedEvent> | null) => void;
  setOnTicketUpdated: (h: Handler<TicketUpdatedEvent> | null) => void;
  setOnTicketAssigned: (h: Handler<TicketAssignedEvent> | null) => void;
  setOnTicketCommented: (h: Handler<TicketCommentedEvent> | null) => void;
  setOnTicketStateChanged: (h: Handler<TicketStateChangedEvent> | null) => void;
  dispatch: (event: WsTicketEvent) => void;
}

export const useWsTicketStore = create<WsTicketStore>((set, get) => ({
  _send: null,
  _pending: new Set<string>(),
  setSend: (fn) => {
    set({ _send: fn });
    const pending = get()._pending;
    if (pending.size > 0) {
      for (const ticketId of pending) {
        fn({ type: "subscribe_ticket", ticket_id: ticketId });
      }
      set({ _pending: new Set<string>() });
    }
  },
  subscribeTicket: (ticketId) => {
    const send = get()._send;
    if (send) {
      send({ type: "subscribe_ticket", ticket_id: ticketId });
    } else {
      get()._pending.add(ticketId);
    }
  },
  unsubscribeTicket: (ticketId) => {
    const send = get()._send;
    get()._pending.delete(ticketId);
    if (send) send({ type: "unsubscribe_ticket", ticket_id: ticketId });
  },
  onTicketCreated: null,
  onTicketUpdated: null,
  onTicketAssigned: null,
  onTicketCommented: null,
  onTicketStateChanged: null,
  setOnTicketCreated: (h) => set({ onTicketCreated: h }),
  setOnTicketUpdated: (h) => set({ onTicketUpdated: h }),
  setOnTicketAssigned: (h) => set({ onTicketAssigned: h }),
  setOnTicketCommented: (h) => set({ onTicketCommented: h }),
  setOnTicketStateChanged: (h) => set({ onTicketStateChanged: h }),
  dispatch: (event) => {
    const s = get();
    if (event.type === "ticket:created") s.onTicketCreated?.(event);
    else if (event.type === "ticket:updated") s.onTicketUpdated?.(event);
    else if (event.type === "ticket:assigned") s.onTicketAssigned?.(event);
    else if (event.type === "ticket:commented") s.onTicketCommented?.(event);
    else if (event.type === "ticket:state_changed") s.onTicketStateChanged?.(event);
  },
}));
