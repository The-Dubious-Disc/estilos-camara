import type { Metadata, Viewport } from "next";
import { caveat, outfit } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://estilos-camara.vercel.app"),
  title: "Retro Pic",
  description:
    "Transforma una foto al look de los 70, una Polaroid de los 90 o una cámara digital de los 2000. El revelado ocurre en tu navegador.",
  applicationName: "Retro Pic",
  openGraph: {
    title: "Retro Pic",
    description:
      "Transforma una foto al look de los 70, una Polaroid de los 90 o una cámara digital de los 2000. El revelado ocurre en tu navegador.",
    siteName: "Retro Pic",
    locale: "es",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#e4e2dc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${caveat.variable} min-h-dvh antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
