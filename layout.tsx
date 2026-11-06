import type { Metadata, Viewport } from "next";
import { caveat, fraunces, outfit } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estilos cámara",
  description:
    "Transforma una foto al look de los 70, una Polaroid de los 90 o una cámara digital de los 2000. El revelado ocurre en tu navegador.",
  applicationName: "Estilos cámara",
};

export const viewport: Viewport = {
  themeColor: "#e7e0d2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${fraunces.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
