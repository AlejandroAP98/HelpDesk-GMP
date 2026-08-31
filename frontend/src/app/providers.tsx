"use client";

import { ReactNode, useEffect } from "react";
import UrgentToasts from "@/components/UrgentToasts";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import { useUrgentStore } from "@/store/urgentStore";
import { useWsTicketStore, type WsTicketEvent } from "@/store/wsTicketStore";
import { useActividadStore } from "@/store/actividadStore";
import type { ActividadLog } from "@/lib/endpoints";

function WebSocketListener() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);
  const addAlert = useUrgentStore((s) => s.addAlert);
  const setSend = useWsTicketStore((s) => s.setSend);
  const dispatch = useWsTicketStore((s) => s.dispatch);
  const addActividad = useActividadStore((s) => s.addNewItem);
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
      : "");

  const { send } = useWebSocket({
    url: wsUrl,
    token,
    onEvent: (ev) => {
      if (ev.type === "ticket:new") {
        const nt = ev as unknown as {
          ticket_id: string;
          empresa_id: number;
          empresa_nombre: string | null;
          titulo: string;
          prioridad: string;
          estado: string;
        };
        if (usuario?.rol === "mesa_ayuda" || usuario?.rol === "administrador") {
          addAlert({
            kind: "new_ticket",
            ticket_id: nt.ticket_id,
            empresa_id: nt.empresa_id,
            empresa_nombre: nt.empresa_nombre ?? undefined,
            titulo: nt.titulo,
            prioridad: nt.prioridad,
            estado: nt.estado,
          });
          if (typeof window !== "undefined" && "Notification" in window) {
            const showNotif = () => {
              try {
                const n = new Notification("Nuevo ticket", {
                  body: `${nt.titulo}\n${nt.empresa_nombre ?? ""} - ${nt.prioridad}`,
                  icon: "/icon-192.png?v4",
                  badge: "/icon-192.png?v4",
                  tag: `new-${nt.ticket_id}`,
                  data: { url: `/tickets/${nt.ticket_id}` },
                });
                n.onclick = () => {
                  try {
                    window.focus();
                  } catch {
                  }
                  window.location.href = `/tickets/${nt.ticket_id}`;
                  n.close();
                };
              } catch {
              }
            };
            if (Notification.permission === "granted") {
              showNotif();
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission()
                .then((perm) => {
                  if (perm === "granted") showNotif();
                })
                .catch(() => undefined);
            }
          }
        }
      } else if (ev.type === "ticket:urgent_created") {
        addAlert({
          ticket_id: (ev as { ticket_id: string }).ticket_id,
          empresa_id: (ev as { empresa_id: number }).empresa_id,
          titulo: (ev as { titulo: string }).titulo,
          prioridad: (ev as { prioridad: string }).prioridad,
          estado: (ev as { estado: string }).estado,
        });
      } else if (
        ev.type === "ticket:created" ||
        ev.type === "ticket:updated" ||
        ev.type === "ticket:assigned" ||
        ev.type === "ticket:commented" ||
        ev.type === "ticket:state_changed"
      ) {
        dispatch(ev as unknown as WsTicketEvent);
        if (ev.type === "ticket:assigned") {
          const assigned = ev as unknown as {
            agente_id: string | null;
            ticket_id: string;
            empresa_id: number;
            titulo: string;
            prioridad: string;
            estado: string;
          };
          if (assigned.agente_id && usuario?.id && assigned.agente_id === usuario.id) {
            addAlert({
              kind: "assigned",
              ticket_id: assigned.ticket_id,
              empresa_id: assigned.empresa_id,
              titulo: assigned.titulo,
              prioridad: assigned.prioridad,
              estado: assigned.estado,
            });
            if (typeof window !== "undefined" && "Notification" in window) {
              const showNotif = () => {
                try {
                  const n = new Notification("Te asignaron un ticket", {
                    body: `${assigned.titulo} - ${assigned.estado} (${assigned.prioridad})`,
                    icon: "/icon-192.png?v4",
                    badge: "/icon-192.png?v4",
                    tag: `assigned-${assigned.ticket_id}`,
                    data: { url: `/tickets/${assigned.ticket_id}` },
                  });
                  n.onclick = () => {
                    try {
                      window.focus();
                    } catch {
                    }
                    window.location.href = `/tickets/${assigned.ticket_id}`;
                    n.close();
                  };
                } catch {
                }
              };
              if (Notification.permission === "granted") {
                showNotif();
              } else if (Notification.permission !== "denied") {
                Notification.requestPermission()
                  .then((perm) => {
                    if (perm === "granted") showNotif();
                  })
                  .catch(() => undefined);
              }
            }
          }
        } else if (ev.type === "ticket:state_changed") {
          const sc = ev as unknown as {
            ticket_id: string;
            empresa_id: number;
            titulo: string;
            prioridad: string;
            estado: string;
            estado_anterior: string;
            estado_nuevo: string;
            cliente_id: string | null;
          };
          if (sc.cliente_id && usuario?.id && sc.cliente_id === usuario.id) {
            addAlert({
              kind: "state_changed",
              ticket_id: sc.ticket_id,
              empresa_id: sc.empresa_id,
              titulo: sc.titulo,
              prioridad: sc.prioridad,
              estado: sc.estado,
              estado_anterior: sc.estado_anterior,
              estado_nuevo: sc.estado_nuevo,
            });
            if (typeof window !== "undefined" && "Notification" in window) {
              const showNotif = () => {
                try {
                  const n = new Notification("Estado del ticket actualizado", {
                    body: `${sc.titulo} - ${sc.estado_anterior} → ${sc.estado_nuevo}`,
                    icon: "/icon-192.png?v4",
                    badge: "/icon-192.png?v4",
                    tag: `state_changed-${sc.ticket_id}`,
                    data: { url: `/tickets/${sc.ticket_id}` },
                  });
                  n.onclick = () => {
                    try {
                      window.focus();
                    } catch {
                    }
                    window.location.href = `/tickets/${sc.ticket_id}`;
                    n.close();
                  };
                } catch {
                }
              };
              if (Notification.permission === "granted") {
                showNotif();
              } else if (Notification.permission !== "denied") {
                Notification.requestPermission()
                  .then((perm) => {
                    if (perm === "granted") showNotif();
                  })
                  .catch(() => undefined);
              }
            }
          }
        } else if (ev.type === "ticket:commented") {
          const cm = ev as unknown as {
            ticket_id: string;
            usuario_id: string;
            usuario_nombre: string;
            es_nota_interna: boolean;
          };
          if (usuario?.id && cm.usuario_id !== usuario.id && !cm.es_nota_interna) {
            addAlert({
              kind: "commented",
              ticket_id: cm.ticket_id,
              comentario_usuario: cm.usuario_nombre,
            });
          }
        }
      } else if (ev.type === "actividad:nueva") {
        const actividad = (ev as unknown as { actividad: ActividadLog }).actividad;
        if (actividad) {
          addActividad(actividad);
        }
      }
    },
  });

  useEffect(() => {
    setSend(send);
  }, [send, setSend]);

  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WebSocketListener />
      <UrgentToasts />
    </>
  );
}
