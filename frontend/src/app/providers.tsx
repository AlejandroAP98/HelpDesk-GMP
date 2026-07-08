"use client";

import { ReactNode, useEffect } from "react";
import UrgentToasts from "@/components/UrgentToasts";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import { useUrgentStore } from "@/store/urgentStore";
import { useWsTicketStore, type WsTicketEvent } from "@/store/wsTicketStore";

function WebSocketListener() {
  const token = useAuthStore((s) => s.token);
  const addAlert = useUrgentStore((s) => s.addAlert);
  const setSend = useWsTicketStore((s) => s.setSend);
  const dispatch = useWsTicketStore((s) => s.dispatch);
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
      : "ws://localhost:8000/ws");

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
        ev.type === "ticket:commented"
      ) {
        dispatch(ev as unknown as WsTicketEvent);
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
