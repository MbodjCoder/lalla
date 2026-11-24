import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Lalla — Le concierge IA des hôtels d'exception" };

const ARGUMENTS = [
  {
    titre: "Chaque client parle sa langue",
    texte:
      "Français, anglais, wolof, espagnol, arabe… Lalla répond instantanément, à partir des seules informations de votre hôtel.",
  },
  {
    titre: "Plus de ventes, moins d'appels",
    texte:
      "Room-service, spa, excursions : commandés depuis le lit, confirmés d'un geste, transmis à la réception sur WhatsApp.",
  },
  {
    titre: "Votre réputation, protégée",
    texte: "Une note basse alerte la direction pendant le séjour — le temps de rattraper l'expérience avant le départ.",
  },
];

export default function PageProduit() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10"
      style={{ "--accent-hotel": "#8c7349" } as React.CSSProperties}
    >
      <p className="font-serif text-[28px] italic">Lalla</p>

      <section className="mt-20 animate-apparition">
        <h1 className="font-serif text-[52px] leading-[1.02] tracking-[-0.01em] sm:text-[72px]">
          Le concierge de vos clients,
          <br />
          <em className="text-accent-profond">dans chaque chambre.</em>
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-encre-douce">
          Un QR code, aucune application. Vos clients écrivent comme à un majordome ; Lalla informe, prend les commandes
          et veille à leur satisfaction — au nom de votre hôtel.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/c/chambre304"
            className="flex h-14 items-center gap-2 rounded-full bg-encre px-7 text-[16px] font-semibold text-white transition active:scale-[0.98]"
          >
            Essayer la démo <ArrowRight className="size-5" />
          </Link>
          <Link
            href="/espace"
            className="flex h-14 items-center rounded-full border border-ligne bg-surface px-7 text-[16px] font-semibold text-encre"
          >
            Espace hôtel
          </Link>
        </div>
      </section>

      <ul className="mt-24 grid gap-8 sm:grid-cols-3">
        {ARGUMENTS.map(({ titre, texte }, rang) => (
          <li key={titre} className="animate-montee" style={{ animationDelay: `${120 + rang * 80}ms` }}>
            <span className="block h-px w-10 bg-accent" />
            <h2 className="mt-4 text-[16px] font-bold text-encre">{titre}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-encre-douce">{texte}</p>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-24 text-[13px] text-encre-pale">Conçu à Dakar pour l&apos;hôtellerie sénégalaise.</p>
    </main>
  );
}
