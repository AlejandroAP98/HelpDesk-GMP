import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import localFont from "next/font/local";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const ubuntu = localFont({
  src: './fonts/Ubuntu-Regular.ttf',
  variable: '--font-custom',
})

export const metadata: Metadata = {
  title: "Soporte Técnico GMP Redes",
  description: "Sistema de soporte técnico GMP Redes",
  applicationName: "Soporte Técnico GMP Redes",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Soporte Técnico GMP Redes",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#416165",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Soporte Técnico GMP Redes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${ubuntu.className} min-h-screen antialiased bg-bgCustom text-gray-900`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
