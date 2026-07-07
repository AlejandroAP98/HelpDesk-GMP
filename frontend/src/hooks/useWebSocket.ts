"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface UrgentTicketEvent {
  type: "ticket:urgent_created";
  ticket_id: string;
  empresa_id: number;
  titulo: string;
  prioridad: string;
  estado: string;
}

export type WsEvent = UrgentTicketEvent | { type: string; [k: string]: unknown };

interface UseWebSocketOptions {
  url: string;
  token: string | null;
  onEvent?: (ev: WsEvent) => void;
  reconnectDelay?: number;
  maxRetries?: number;
}

export function useWebSocket({
  url,
  token,
  onEvent,
  reconnectDelay = 3000,
  maxRetries = 10,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    wsRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!token) {
      setStatus("idle");
      return;
    }
    cleanup();
    const fullUrl = `${url}?token=${encodeURIComponent(token)}`;
    setStatus("connecting");
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      setStatus("open");
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as WsEvent;
        onEventRef.current?.(data);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
      wsRef.current = null;
      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        reconnectTimer.current = setTimeout(connect, reconnectDelay);
      }
    };
  }, [url, token, maxRetries, reconnectDelay, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { status, send, reconnect: connect, close: cleanup };
}