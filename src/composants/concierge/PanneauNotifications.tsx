"use client";

import { Check, ConciergeBell, X } from "lucide-react";
import { useEffect } from "react";
import { cleJour, heureMessage, libelleJour } from "@/lib/format";
import type { CleTexteClient, TraduireClient } from "@/lib/i18n/client";
import { choisirTraduction, type LangueClient } from "@/lib/langues";
import type { IssueNotification, NotificationClient } from "./notifications";

type Proprietes = {
  notifications: NotificationClient[];
  nonLues: ReadonlySet<string>; // non lues à l'ouverture : elles gardent leur point
  langue: LangueClient;
  t: TraduireClient;
  onFermer: () => void;
  onOuvrir: (notification: NotificationClient) => void;
};

const ICONES: Record<IssueNotification, typeof Check> = {
  acceptee: Check,
  repondue: ConciergeBell,
  declinee: X,
};

function titre({ issue, demande }: NotificationClient): CleTexteClient {
  if (issue === "repondue") return "notifRepondue";
  if (issue === "declinee") return "notifDeclinee";
  return demande.type === "COMMANDE" ? "notifCommandeAcceptee" : "notifDemandeAcceptee";
}

// Liste des notifications, descendue du haut sous l'en-tête. Toucher une notification ferme la
// liste et amène sa carte dans le fil, dans son état réel.
export function PanneauNotifications({ notifications, nonLues, langue, t, onFermer, onOuvrir }: Proprietes) {
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => evenement.key === "Escape" && onFermer();
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const moment = (instant: string) => {
    const heure = heureMessage(instant, langue);
    return cleJour(instant) === cleJour(new Date().toISOString())
      ? heure
      : `${libelleJour(instant, langue, t("aujourdhui"), t("hier"))} · ${heure}`;
  };

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal aria-label={t("notifications")}>
      <button
        type="button"
        aria-label={t("fermer")}
        onClick={onFermer}
        className="absolute inset-0 animate-voile bg-black/25"
      />
      <div className="relative mx-auto max-w-xl animate-descente rounded-b-[28px] bg-surface pt-[env(safe-area-inset-top)] shadow-[0_24px_50px_-24px_rgb(26_27_23/0.45)]">
        <div className="flex h-[76px] items-center justify-between ps-5 pe-3">
          <h2 className="texte-titres text-titres">{t("notifications")}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label={t("fermer")}
            className="grid size-11 place-items-center rounded-full text-encre transition active:scale-90 active:bg-creux"
          >
            <X className="size-[22px]" strokeWidth={2.4} />
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="px-5 pt-2 pb-8 text-center text-[15px] text-encre-douce">{t("aucuneNotification")}</p>
        ) : (
          <ul className="max-h-[min(70dvh,520px)] divide-y divide-ligne/70 overflow-y-auto px-3 pb-3">
            {notifications.map((notification) => {
              const Icone = ICONES[notification.issue];
              const resume = choisirTraduction(
                notification.demande.textes,
                langue,
                notification.demande.textes.fr,
              ).resume;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => onOuvrir(notification)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-start transition active:bg-creux"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-creux" aria-hidden>
                      <Icone className="size-[19px]" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-black">{t(titre(notification))}</span>
                      <span className="block truncate text-[13.5px] text-encre-douce">{resume}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      {notification.le && (
                        <span className="text-[12px] tabular-nums text-encre-pale">{moment(notification.le)}</span>
                      )}
                      {nonLues.has(notification.id) && <span className="size-2.5 rounded-full bg-alerte" aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
