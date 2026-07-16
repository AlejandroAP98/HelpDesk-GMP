/**
 * Helper para detectar si la app esta corriendo dentro de Capacitor (WebView nativo)
 * vs un navegador web normal.
 */
import { Capacitor } from '@capacitor/core';

export type NativePlatform = 'ios' | 'android' | 'web';

export function getPlatform(): NativePlatform {
  if (Capacitor.isNativePlatform()) {
    const p = Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
  }
  return 'web';
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}
