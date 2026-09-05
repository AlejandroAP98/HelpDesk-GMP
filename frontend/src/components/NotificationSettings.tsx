"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { pushApi, preferencesApi, type PushSubscriptionOut } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

function shortEndpoint(ep: string): string {
  if (ep.length <= 50) return ep;
  return ep.slice(0, 28) + "..." + ep.slice(-18);
}

function shortUA(ua: string | null): string {
  if (!ua) return "Web";
  if (ua.includes("Chrome")) return ua.includes("Edg") ? "Edge" : "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Web";
}

export default function NotificationSettings() {
  const { state, subscribe, unsubscribe, refresh } = useNotificationPermission();
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);
  const updateUsuario = useAuthStore((s) => s.updateUsuario);
  const [subs, setSubs] = useState<PushSubscriptionOut[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const emailEnabled = usuario?.notificaciones_email ?? true;

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

  const handleQuitarTodas = async () => {
    try {
      await pushApi.unsubscribeAll();
      await cargar();
      await refresh();
    } catch {
    }
  };

  const handleTest = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (typeof window === "undefined" || !("Notification" in window)) {
        setError("Tu navegador no soporta notificaciones.");
        return;
      }
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setError("Permiso de notificaciones no concedido. Habilitalo en el candado junto a la URL.");
          return;
        }
      }
      let inAppOk = false;
      try {
        const n = new Notification("HelpDesk-GMP - Notificacion de prueba", {
          body: "Notificacion in-app funcionando. Las push reales requieren PWA instalada.",
          icon: "/icon-192.png?v4",
          badge: "/icon-192.png?v4",
          tag: "test-in-app",
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch {
          }
          n.close();
        };
        inAppOk = true;
      } catch {
      }
      if (state === "active" && subs.length > 0) {
        const result = await pushApi.sendTest();
        if (result.delivered > 0) {
          setSuccess(
            `Push enviado a ${result.delivered} dispositivo(s).` +
              (inAppOk ? " Notificacion in-app mostrada tambien." : "")
          );
        } else {
          setError(
            "El push real fallo. El backend no pudo entregar a ninguna suscripcion. Vuelve a activar las notificaciones (Desactivar > Activar) para crear una suscripcion nueva."
          );
        }
      } else if (state === "active" && subs.length === 0) {
        setSuccess(
          inAppOk
            ? "Notificacion in-app funcionando. No hay dispositivos suscritos para push real. Volvé a activar para crear una suscripción."
            : "No hay suscripciones push. Desactiva y vuelve a activar para crear una."
        );
      } else {
        setSuccess(
          inAppOk
            ? "Notificacion in-app funcionando. Activa las notificaciones push para recibir alertas con la PWA instalada."
            : "Activa las notificaciones para recibir alertas."
        );
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleToggleEmail = async () => {
    setEmailBusy(true);
    setEmailError(null);
    try {
      const updated = await preferencesApi.update({ notificaciones_email: !emailEnabled });
      updateUsuario(updated);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Error al actualizar preferencias");
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="space-y-4 ">
      {/* Seccion: Notificaciones push */}
      {state === "unsupported" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-medium text-gray-900">Notificaciones push</h3>
          <p className="mt-2 text-sm text-gray-500">
            Tu navegador no soporta notificaciones push. Proba con Chrome, Edge o Firefox recientes.
          </p>
        </div>
      ) : state === "denied" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-medium text-gray-900">Notificaciones push</h3>
          <p className="mt-2 text-sm text-gray-500">
            Los permisos de notificacion fueron bloqueados. Para habilitarlos, entra a la
            configuracion del navegador (icono de candado junto a la URL) y permite las
            notificaciones para este sitio.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">Notificaciones push</h3>
              <p className="mt-1 text-sm text-gray-500">
                Recibirás alertas de los cambios de estado de tus tickets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {state === "active" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Activado
                </span>
              ) : state === "inactive" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
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
              <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Dispositivos suscritos
              </h4>
              {loadingList ? (
                <p className="mt-2 text-sm text-gray-400">Cargando...</p>
              ) : subs.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">No hay dispositivos suscritos.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-2">
                    {subs.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-normal text-gray-800">
                            {shortUA(s.user_agent)}
                          </p>
                          <p className="truncate text-xs text-gray-400" title={s.endpoint}>
                            {shortEndpoint(s.endpoint)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleQuitar(s.endpoint)}
                          className="ml-2 text-xs font-normal text-red-600 hover:text-red-700"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                  {subs.length > 1 && (
                    <button
                      onClick={handleQuitarTodas}
                      className="mt-3 text-xs font-normal text-red-600 hover:text-red-700"
                    >
                      Quitar todas las suscripciones
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {usuario?.rol !== "agente" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-medium text-gray-900">Notificaciones por correo</h3>
              <p className="mt-1 text-sm text-gray-500">
                Recibirás por email confirmaciones de tickets creados y resueltos.
              </p>
            </div>
            <button
              type="button"
              disabled={emailBusy}
              onClick={handleToggleEmail}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${
                emailEnabled ? "bg-brandCustom" : "bg-grayCustom/50"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  emailEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {emailEnabled
              ? "Actualmente recibiendo emails de notificacion."
              : "No recibiras emails de notificacion. Puedes cambiar esto en cualquier momento."}
          </p>
          {emailError && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{emailError}</p>
          )}
        </div>
      )}
    </div>
    
  );
}
