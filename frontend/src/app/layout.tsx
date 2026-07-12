import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import localFont from "next/font/local";

const ubuntu = localFont({
  src: './fonts/Ubuntu-Regular.ttf',
  variable: '--font-custom',
})

export const metadata: Metadata = {
  title: "HelpDesk-GMP",
  description: "Sistema de gestion de tickets multi-tenant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${ubuntu.className} min-h-screen antialiased bg-bgCustom text-gray-900`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
