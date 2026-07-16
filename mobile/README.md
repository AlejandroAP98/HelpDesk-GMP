# HelpDesk-GMP Mobile

App móvil nativa para HelpDesk-GMP construida con **Capacitor** que envuelve la PWA existente y agrega notificaciones push nativas via **FCM** (Android) y **APNs** (iOS).

## Stack

- **Capacitor 6** — wrapper nativo para iOS y Android
- **@capacitor/push-notifications** — plugin push nativo
- **Firebase Cloud Messaging (FCM)** — push Android (gratis)
- **Apple Push Notification service (APNs)** — push iOS (requiere Apple Developer $99/año)
- **firebase-admin** — SDK Python para enviar push desde el backend

## Comandos principales

```bash
# Instalar dependencias
npm install

# Build del frontend (necesario antes de cap sync)
cd ../frontend
npm install @capacitor/core @capacitor/push-notifications --legacy-peer-deps
$env:MOBILE_BUILD="true"   # PowerShell: $env:MOBILE_BUILD="true"
npx next build
cd ../mobile

# Sincronizar cambios del frontend con las plataformas nativas
npx cap sync android

# Build APK release (requiere Docker con Android SDK)
docker run --rm -v ${PWD}:/mobile -e ANDROID_HOME=/opt/android-sdk-linux \
  runmymind/docker-android-sdk \
  sh -c 'cd /mobile/android && ./gradlew :app:assembleRelease --no-daemon'

# El APK firmado queda en:
# mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Setup de Firebase (ya hecho)

1. ✅ Proyecto Firebase creado: `gmp-soporte`
2. ✅ App Android agregada: `com.gmpredes.helpdesk`
3. ✅ `google-services.json` en `android/app/`
4. ✅ `firebase-credentials.json` en `backend/app/`
5. ✅ `FIREBASE_CREDENTIALS_PATH=/app/firebase-credentials.json` en `.env` raíz

## Instalar el APK en un dispositivo

1. **Habilitar instalación de apps desconocidas**:
   - Ajustes → Seguridad → Instalar apps desconocidas → Permitir
2. **Transferir el APK** al dispositivo (USB, email, Drive, etc.)
3. **Abrir el APK** desde el explorador de archivos del teléfono
4. **Aceptar la instalación**

> El APK está firmado con un keystore autogenerado (self-signed). En Android 8+ hay que confirmar el origen.

## Probar push end-to-end

1. Abrir la app
2. Login con un usuario (admin o agente)
3. La app debe pedir permiso de notificaciones → Aceptar
4. Verificar que aparece en `NotificationSettings` como "Android nativo"
5. En otra ventana, ir al panel admin → crear un ticket urgente
6. La notificación debe llegar a la app nativa con app cerrada

## Troubleshooting

### La app no muestra el WebView

- Verificar que el backend esté accesible: `https://soporte.gmpredes.online/api/health`
- Revisar logs: `adb logcat | grep Capacitor`

### FCM no llega

- El dispositivo debe tener Google Play Services
- Verificar que `google-services.json` corresponde al proyecto
- Verificar que `firebase-credentials.json` tiene permisos de FCM

### "App not installed" al instalar

- Desinstalar la versión anterior primero
- Verificar que el dispositivo permite instalar de orígenes desconocidos

## Limitaciones

- iOS requiere Mac con Xcode + Apple Developer $99/año
- Emulador Android sin Google Play Services: FCM no funciona
- El APK está firmado con un keystore de desarrollo (NO usar para producción)
