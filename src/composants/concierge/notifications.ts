"use client";

// Notifications du client : chaque décision de la réception sur une de ses cartes (commande ou
// demande acceptée, question répondue, demande déclinée). Elles se lisent dans le fil lui-même :
// rien n'est stocké côté serveur, seules celles déjà vues sont retenues sur le téléphone.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DemandeVue, ElementFil } from "@/lib/types";

export type IssueNotification = "acceptee" | "repondue" | "declinee";

export type NotificationClient = {
  id: string; // une par décision : « <demande>:<statut> »
  demande: DemandeVue;
  issue: IssueNotification;
  le: string | null; // instant ISO de la décision
};

// Au-delà, les plus anciennes ne sont plus retenues (une conversation reste courte)
const VUES_MAX = 200;

function issueDe(demande: DemandeVue): IssueNotification | null {
  if (demande.declinee) return "declinee";
  if (demande.statut !== "TERMINEE") return null;
  return demande.type === "QUESTION" ? "repondue" : "acceptee";
}

/** Les décisions de la réception présentes dans le fil, la plus récente en premier. */
function notificationsDuFil(elements: ElementFil[]): NotificationClient[] {
  const parDemande = new Map<string, NotificationClient>();
  for (const element of elements) {
    if (element.genre !== "demande") continue;
    const { demande } = element;
    const issue = issueDe(demande);
    if (issue)
      parDemande.set(demande.id, { id: `${demande.id}:${demande.statut}`, demande, issue, le: demande.decideeLe });
  }
  return [...parDemande.values()].sort((a, b) => (b.le ?? "").localeCompare(a.le ?? ""));
}

function lireVues(cle: string): string[] {
  try {
    const valeur = JSON.parse(localStorage.getItem(cle) ?? "[]");
    return Array.isArray(valeur) ? valeur.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function useNotifications(jeton: string, elements: ElementFil[]) {
  const cle = `lalla:notifications-vues:${jeton}`;
  const [vues, setVues] = useState<string[]>([]);
  const notifications = useMemo(() => notificationsDuFil(elements), [elements]);

  useEffect(() => setVues(lireVues(cle)), [cle]);

  const nonLues = notifications.filter((notification) => !vues.includes(notification.id)).length;

  /** Toutes celles affichées sont désormais vues (à l'ouverture de la liste). */
  const marquerVues = useCallback(() => {
    setVues((precedentes) => {
      const suivantes = [...new Set([...precedentes, ...notifications.map(({ id }) => id)])].slice(-VUES_MAX);
      try {
        localStorage.setItem(cle, JSON.stringify(suivantes));
      } catch {
        // Navigation privée : la pastille reviendra simplement au rechargement
      }
      return suivantes;
    });
  }, [cle, notifications]);

  return { notifications, nonLues, vues, marquerVues };
}
