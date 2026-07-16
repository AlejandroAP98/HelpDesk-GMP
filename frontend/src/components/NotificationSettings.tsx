"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { getPlatformInfo, isNotificationApiAvailable } from "@/lib/notifications";
import { pushApi, type PushSubscriptionOut } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

function shortEndpoint(ep: string): string {
  if (ep.length <= 50) return ep;
  return ep.slice(0, 28) + "..." + ep.slice(-18);
}

function shortUA(ua: string | null, plataforma: string): string {
  if (plataforma === "ios") return "iOS (nativo)";
  if (plataforma === "android") return "Android (nativo)";
  if (!ua) return "Web";
  if (ua.includes("Chrome")) return ua.includes("Edg") ? "Edge" : "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Web";
}

function platformIcon(plataforma: string): string {
  if (plataforma === "ios") return "phone_iphone";
  if (plataforma === "android") return "android";
  return "language";
}

export default function NotificationSettings() {
  const { state, subscribe, unsubscribe, refresh } = useNotificationPermission();
  const token = useAuthStore((s) => s.token);
  const [subs, setSubs] = useState<PushSubscriptionOut[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargar = async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const lista = await pushApi.listMySubscriptions();
      setSubs(lista);
    } catch {
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [token]);

  useEffect(() => {
    if (state === "active" || state === "inactive") {
      void cargar();
    }
  }, [state]);

  const handleToggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (state === "active") {
        await unsubscribe();
      } else if (state === "inactive") {
        const ok = await subscribe();
        if (!ok) setError("No se pudo activar. Verifica los permisos del navegador.");
      }
      await refresh();
      await cargar();
    } finally {
      setBusy(false);
    }
  };

  const handleQuitar = async (endpoint: string) => {
    try {
      await pushApi.unsubscribe(endpoint);
      await cargar();
    } catch {
    }
  };

  const handleTest = async () => {
    setError(null);
    setSuccess(null);
    const platform = getPlatformInfo();
    const isNative = platform === "android" || platform === "ios";
    try {
      if (!isNative && !isNotificationApiAvailable()) {
        setError("Tu navegador no soporta notificaciones.");
        return;
      }
      if (!isNative && Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setError("Permiso de notificaciones no concedido. Habilitalo en el candado junto a la URL.");
          return;
        }
      }
      if (state === "active" && subs.length > 0) {
        const result = await pushApi.sendTest();
        if (result.delivered > 0) {
          setSuccess(
            `Push enviado a ${result.delivered} dispositivo(s).` +
              (isNative ? " Revisa tu telefono/tablet." : " Notificacion in-app mostrada tambien.")
          );
        } else {
          setError(
            "El push real fallo. El backend no pudo entregar a ninguna suscripcion. Vuelve a activar las notificaciones (Desactivar > Activar) para crear una suscripcion nueva."
          );
        }
      } else if (state === "active" && subs.length === 0) {
        setSuccess(
          isNative
            ? "No hay suscripciones push. Desactiva y vuelve a activar para crear una."
            : "Notificacion in-app funcionando. No hay dispositivos suscritos para push real. Volvé a activar para crear una suscripción."
        );
      } else {
        setSuccess(
          isNative
            ? "Activa las notificaciones para recibir alertas con la app cerrada."
            : "Activa las notificaciones para recibir alertas."
        );
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (state === "unsupported") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Notificaciones push</h3>
        <p className="mt-2 text-sm text-gray-500">
          Tu navegador no soporta notificaciones push. Proba con Chrome, Edge o Firefox recientes.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Notificaciones push</h3>
        <p className="mt-2 text-sm text-gray-500">
          Los permisos de notificacion fueron bloqueados. Para habilitarlos, entra a la
          configuracion del navegador (icono de candado junto a la URL) y permite las
          notificaciones para este sitio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Notificaciones push</h3>
          <p className="mt-1 text-sm text-gray-500">
            Recibi alertas de tickets urgentes y asignaciones aunque no estes conectado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === "active" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Activado
            </span>
          ) : state === "inactive" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
              Desactivado
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {state === "active" ? (
          <Button variant="secondary" onClick={handleToggle} disabled={busy}>
            Desactivar notificaciones
          </Button>
        ) : (
          <Button onClick={handleToggle} disabled={busy}>
            {busy ? "Procesando..." : "Activar notificaciones"}
          </Button>
        )}
        <Button variant="secondary" onClick={handleTest} disabled={busy}>
          Probar
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">{success}</p>
      )}

      {state === "active" && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Dispositivos suscritos
          </h4>
          {loadingList ? (
            <p className="mt-2 text-sm text-gray-400">Cargando...</p>
          ) : subs.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">No hay dispositivos suscritos.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {subs.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {shortUA(s.user_agent, s.plataforma)}
                    </p>
                    <p className="truncate text-xs text-gray-400" title={s.endpoint}>
                      {shortEndpoint(s.endpoint)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleQuitar(s.endpoint)}
                    className="ml-2 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
