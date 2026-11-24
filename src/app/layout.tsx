import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Instrument_Serif, Manrope } from "next/font/google";
import { classesPolices } from "@/lib/polices";
import "./globals.css";

const policeTexte = Manrope({
  subsets: ["latin"],
  variable: "--police-texte",
  display: "swap",
});

// Police arabe : téléchargée seulement si du texte arabe est affiché
const policeArabe = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--police-arabe",
  display: "swap",
});

const policeTitre = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--police-titre",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lalla — Concierge",
  description: "Votre concierge personnel, dans votre langue, à toute heure.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lalla" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8f3",
  interactiveWidget: "resizes-content",
};

export default function MiseEnPageRacine({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${policeTexte.variable} ${policeTitre.variable} ${policeArabe.variable} ${classesPolices}`}
    >
      <body>{children}</body>
    </html>
  );
}
