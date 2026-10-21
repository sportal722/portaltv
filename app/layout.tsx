import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "NEXORA — Tu mundo, en directo",
  description:
    "Descubre tu próxima comunidad. Gaming, música y conversaciones en una nueva experiencia de streaming. Entra en NEXORA.",
  applicationName: "NEXORA",
  openGraph: {
    title: "NEXORA — Tu mundo, en directo",
    description: "Conecta. Comparte. Vive el directo.",
    locale: "es_ES",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
