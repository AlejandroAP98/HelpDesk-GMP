"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { silentRefresh } from "@/lib/api";

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
  pingIntervalMs?: number;
}

const PING_INTERVAL_MS_DEFAULT = 60_000;

export function useWebSocket({
  url,
  token,
  onEvent,
  reconnectDelay = 3000,
  maxRetries = 10,
  pingIntervalMs = PING_INTERVAL_MS_DEFAULT,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const retriesRef = useRef(0);
  const authFailedRef = useRef(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const stopPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    stopPing();
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
  }, [stopPing]);

  const connect = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      setStatus("idle");
      return;
    }
    cleanup();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    authFailedRef.current = false;
    setStatus("connecting");

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }));
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as WsEvent;
        if (data.type === "auth_ok") {
          authFailedRef.current = false;
          retriesRef.current = 0;
          setStatus("open");
          stopPing();
          pingTimer.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "ping", ts: Date.now() }));
            }
          }, pingIntervalMs);
          return;
        }
        if (data.type === "auth_error") {
          authFailedRef.current = true;
          setStatus("error");
          ws.close();
          return;
        }
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
      stopPing();
      if (retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        reconnectTimer.current = setTimeout(async () => {
          if (authFailedRef.current && tokenRef.current) {
            authFailedRef.current = false;
            const fresh = await silentRefresh();
            if (!fresh && !tokenRef.current) return;
          }
          connect();
        }, reconnectDelay);
      }
    };
  }, [url, maxRetries, reconnectDelay, cleanup, pingIntervalMs, stopPing]);

  useEffect(() => {
    if (token) {
      const ws = wsRef.current;
      const needsConnect =
        !ws ||
        ws.readyState === WebSocket.CLOSED ||
        ws.readyState === WebSocket.CLOSING;
      if (needsConnect) {
        retriesRef.current = 0;
        connect();
      }
    } else {
      cleanup();
      setStatus("idle");
    }
  }, [token, connect, cleanup]);

  useEffect(() => {
    const onVisibility = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        (wsRef.current === null ||
          wsRef.current.readyState === WebSocket.CLOSED ||
          wsRef.current.readyState === WebSocket.CLOSING) &&
        tokenRef.current
      ) {
        retriesRef.current = 0;
        connect();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [connect]);

  useEffect(() => cleanup, [cleanup]);

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
