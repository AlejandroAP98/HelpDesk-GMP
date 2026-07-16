/**
 * Wrapper unificado de push notifications.
 *
 * - En Capacitor (nativo): usa FCM/APNs via @capacitor/push-notifications
 * - En Web (PWA): usa Web Push API con VAPID (codigo existente)
 *
 * La interfaz es la misma para que el frontend no sepa la diferencia.
 */
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { pushApi } from '../endpoints';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

export interface SubscribeResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export type UnsubscribeResult = boolean;

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface NotificationHandler {
  onNotification?: (payload: PushPayload) => void;
  onActionClick?: (actionId: string, payload: PushPayload) => void;
}

let initialized = false;
let currentHandler: NotificationHandler = {};

/**
 * Inicializa el sistema de push. Llamar una sola vez al arrancar la app.
 */
export async function initPush(handler: NotificationHandler): Promise<void> {
  currentHandler = handler;

  if (!isCapacitorPush()) {
    return;
  }

  try {
    await PushNotifications.createChannel({
      id: 'helpdesk-default',
      name: 'HelpDesk GMP',
      description: 'Notificaciones de tickets',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
    });
  } catch (e) {
    console.warn('No se pudo crear el canal de notificacion:', e);
  }

  PushNotifications.addListener('registration', (token: Token) => {
    console.log('FCM/APNs token received:', token.value.slice(0, 20) + '...');
    pushApi
      .subscribe({
        endpoint: token.value,
        plataforma: Capacitor.getPlatform() as 'ios' | 'android',
        user_agent: navigator.userAgent.slice(0, 255),
      })
      .then(() => console.log('Token registrado en backend'))
      .catch((e) => console.error('Error registrando token:', e));
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Error en registro push:', err.error);
  });

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      const payload: PushPayload = {
        title: notification.title || 'HelpDesk',
        body: notification.body || '',
        data: notification.data,
      };
      currentHandler.onNotification?.(payload);
    },
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      const payload: PushPayload = {
        title: action.notification.title || 'HelpDesk',
        body: action.notification.body || '',
        data: action.notification.data,
      };
      const actionId = action.actionId || 'default';
      currentHandler.onActionClick?.(actionId, payload);
    },
  );

  initialized = true;
}

/**
 * Solicita permiso y suscribe al usuario a push nativas.
 */
export async function subscribeToNativePush(): Promise<SubscribeResult> {
  if (!isCapacitorPush()) {
    console.warn('[capacitor/push] subscribeToNativePush: no es nativo o plugin no disponible');
    return { ok: false, error: 'No es plataforma nativa' };
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[capacitor/push] permiso actual:', permStatus.receive);
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
      console.log('[capacitor/push] permiso tras request:', permStatus.receive);
    }
    if (permStatus.receive !== 'granted') {
      return { ok: false, error: 'Permiso denegado' };
    }
    console.log('[capacitor/push] registrando para FCM...');
    await PushNotifications.register();
    console.log('[capacitor/push] registro OK, esperando token...');
    return { ok: true };
  } catch (e) {
    console.error('[capacitor/push] subscribeToNativePush error:', e);
    return { ok: false, error: String(e) };
  }
}

/**
 * Desuscribe del push nativo.
 */
export async function unsubscribeFromNativePush(): Promise<UnsubscribeResult> {
  if (!isCapacitorPush()) {
    return false;
  }
  try {
    const sub = await PushNotifications.getDeliveredNotifications();
    if (sub.notifications.length > 0) {
      await PushNotifications.removeAllDeliveredNotifications();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica el estado del permiso.
 */
export async function getPushPermission(): Promise<PermissionState> {
  if (!isCapacitorPush()) {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as PermissionState;
  }
  try {
    const status = await PushNotifications.checkPermissions();
    return status.receive as PermissionState;
  } catch {
    return 'unsupported';
  }
}

function isCapacitorPush(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
}

export function isPushAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorPush()) return true;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
