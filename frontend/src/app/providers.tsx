"use client";

import { ReactNode, useEffect } from "react";
import UrgentToasts from "@/components/UrgentToasts";
import { useWebSocket } from "@/hooks/useWebSocket";
import { autoInitNativePush } from "@/lib/notifications";
import { useAuthStore } from "@/store/authStore";
import { useUrgentStore } from "@/store/urgentStore";
import { useWsTicketStore, type WsTicketEvent } from "@/store/wsTicketStore";

function WebSocketListener() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);
  const addAlert = useUrgentStore((s) => s.addAlert);
  const setSend = useWsTicketStore((s) => s.setSend);
  const dispatch = useWsTicketStore((s) => s.dispatch);
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
      : "");

  const { send } = useWebSocket({
    url: wsUrl,
    token,
    onEvent: (ev) => {
      if (ev.type === "ticket:urgent_created") {
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
        ev.type === "ticket:commented"
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
                    icon: "/icon-192.png?v2",
                    badge: "/icon-192.png?v2",
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
        }
      }
    },
  });

  useEffect(() => {
    setSend(send);
  }, [send, setSend]);

  return null;
}

function NativePushInit() {
  const usuario = useAuthStore((s) => s.usuario);
  useEffect(() => {
    if (usuario) {
      void autoInitNativePush();
    }
  }, [usuario]);
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <WebSocketListener />
      <NativePushInit />
      <UrgentToasts />
    </>
  );
}
