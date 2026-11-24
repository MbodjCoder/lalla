"use client";

import { Bell } from "lucide-react";
import type { TraduireClient } from "@/lib/i18n/client";

type Proprietes = {
  t: TraduireClient;
  hotel: { nom: string; sousTitre: string | null; logoUrl: string | null };
  notificationsNonLues: number;
  onOuvrirNotifications: () => void;
  onOuvrirMenu: () => void;
};

const BOUTON_ROND =
  "relative grid size-11 shrink-0 place-items-center rounded-full bg-surface text-black shadow-[0_1px_2px_rgb(26_27_23/0.06),0_8px_20px_-12px_rgb(26_27_23/0.35)] transition active:scale-90";

// En-tête du client : l'identité de l'hôtel (son logo, sinon son nom et sa mention), puis les notifications et le menu,
// sous le pouce. Le tout tient dans la hauteur d'une barre de messagerie.
export function EnTete({ t, hotel, notificationsNonLues, onOuvrirNotifications, onOuvrirMenu }: Proprietes) {
  return (
    <header className="sticky top-0 z-20 border-b border-ligne/70 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[76px] max-w-xl items-center justify-between gap-3 ps-5 pe-3">
        {hotel.logoUrl ? (
          // Le logo de l'hôtel porte déjà son nom : il occupe seul la place, comme sur sa façade
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hotel.logoUrl} alt={hotel.nom} className="h-11 w-auto min-w-0 shrink object-contain object-left" />
        ) : (
          <div className="flex min-w-0 flex-col items-center text-center">
            <p className="max-w-full truncate text-[15.5px] leading-[1.2] font-medium text-encre-douce">{hotel.nom}</p>
            {hotel.sousTitre && (
              <p className="max-w-full truncate text-[9.5px] leading-[1.3] font-semibold tracking-[0.32em] text-mention-hotel uppercase">
                {hotel.sousTitre}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOuvrirNotifications}
            aria-label={t("notifications")}
            aria-haspopup="dialog"
            className="relative grid size-11 shrink-0 place-items-center rounded-full text-black transition active:scale-90 active:bg-creux"
          >
            <Bell className="size-6" strokeWidth={2.1} />
            {notificationsNonLues > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-alerte px-1 text-[11px] leading-none font-bold text-white tabular-nums">
                {notificationsNonLues}
              </span>
            )}
          </button>

          {/* Menu : rubriques et langue */}
          <button type="button" onClick={onOuvrirMenu} aria-label={t("menu")} className={BOUTON_ROND}>
            <svg
              viewBox="0 0 24 24"
              className="size-[30px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3 5h18M3 12h18M3 19h18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
