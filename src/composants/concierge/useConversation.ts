"use client";

// État du fil de discussion : envoi, lecture du flux NDJSON, décisions sur
// les cartes, suivi en direct des demandes transmises, reprise après
// rechargement de la page, traduction du fil au changement de langue.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceDirect } from "@/lib/services-directs";
import type { ArticleRefuseVue, DemandeVue, ElementFil, EvenementFlux } from "@/lib/types";

const INTERVALLE_SUIVI_MS = 6000;
// Messages tolérés sous une carte avant de considérer que la discussion a avancé
const ELEMENTS_VISIBLES_APRES_CARTE = 1;

// Identifiant local (crypto.randomUUID exige un contexte sécurisé, absent en test sur réseau local)
let compteur = 0;
const identifiantLocal = () => `local-${Date.now().toString(36)}-${(compteur++).toString(36)}`;

function lireStockage(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireStockage(cle: string, valeur: string | null) {
  try {
    if (valeur) localStorage.setItem(cle, valeur);
    else localStorage.removeItem(cle);
  } catch {
    // Navigation privée : la conversation ne survivra simplement pas au rechargement
  }
}

/** Demande créée d'un geste depuis l'interface (panier du room service, service courant). */
export type DemandeDirecte =
  | {
      genre: "commande";
      lignes: { articleId: string; quantite: number }[];
      reservation?: { jour: string; heure?: string }; // excursion, soin, transfert
      precision?: string; // numéro de vol…
    }
  | {
      genre: "service";
      service: ServiceDirect;
      precisions?: { jour?: string; heure?: string; texte?: string }; // réveil, taxi, départ tardif
    };

export type ResultatDemandeDirecte =
  | { ok: true }
  | {
      ok: false;
      erreur: "reseau" | "commandesFermees" | "refusee" | "momentInvalide";
      refuses: ArticleRefuseVue[];
    };

type Options = {
  jeton: string;
  langue: string;
  avisAttendu: boolean;
};

// Préchauffage du serveur et de la base (sortis de veille avant le premier message) :
// assez souvent pour qu'ils restent éveillés pendant que le client lit ou écrit
const INTERVALLE_PRECHAUFFAGE_MS = 3 * 60 * 1000;

export function useConversation({ jeton, langue, avisAttendu }: Options) {
  const [elements, setElements] = useState<ElementFil[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [attenteReponse, setAttenteReponse] = useState(false);
  const [traductionEnCours, setTraductionEnCours] = useState(false);
  const conversationId = useRef<string | null>(null);
  // Verrou immédiat : deux appuis rapides partent avant que l'état « enCours » ne soit rendu
  const envoiEnCours = useRef(false);
  const cleStockage = `lalla:conversation:${jeton}`;
  const dernierPrechauffage = useRef(0);

  /** Réveille le serveur et la base, au plus une fois toutes les trois minutes. */
  const prechauffer = useCallback(() => {
    if (Date.now() - dernierPrechauffage.current < INTERVALLE_PRECHAUFFAGE_MS) return;
    dernierPrechauffage.current = Date.now();
    fetch("/api/conversation?prechauffer=1", {
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      dernierPrechauffage.current = 0; // réseau coupé : on retentera au prochain geste
    });
  }, []);

  // Dès l'ouverture de la discussion, et à chaque retour sur l'onglet
  useEffect(() => {
    prechauffer();
    const auRetour = () => !document.hidden && prechauffer();
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, [prechauffer]);

  // Reprise d'une conversation existante (même séjour uniquement, vérifié côté serveur)
  useEffect(() => {
    const id = lireStockage(cleStockage);
    if (!id) return;
    let annule = false;
    fetch(`/api/conversation?jeton=${encodeURIComponent(jeton)}&id=${encodeURIComponent(id)}`)
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then((donnees: { fil: ElementFil[] | null } | null) => {
        if (annule) return;
        if (!donnees?.fil?.length) return ecrireStockage(cleStockage, null);
        conversationId.current = id;
        setElements(avisAttendu ? [...donnees.fil, { genre: "avis", id: "avis-depart" }] : donnees.fil);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [jeton, cleStockage, avisAttendu]);

  // Chaque changement d'état d'une carte (transmise, acceptée, annulée, répondue) fait sonner la sonnette
  const [changementsEtat, setChangementsEtat] = useState(0);

  /**
   * Nouvel état d'une carte : mise à jour sur place ; si la discussion a avancé depuis,
   * la carte est reprise en bas du fil pour que le client voie le changement.
   */
  const elementsCourants = useRef(elements);
  elementsCourants.current = elements;
  const remplacerDemande = useCallback((demande: DemandeVue) => {
    const affichee = elementsCourants.current.findLast(
      (element): element is Extract<ElementFil, { genre: "demande" }> =>
        element.genre === "demande" && element.demande.id === demande.id,
    );
    if (affichee && affichee.demande.statut !== demande.statut) setChangementsEtat((nombre) => nombre + 1);
    setElements((precedents) => {
      const derniere = precedents.findLastIndex(
        (element) => element.genre === "demande" && element.demande.id === demande.id,
      );
      if (derniere === -1) return precedents;
      const ancienne = precedents[derniere] as Extract<ElementFil, { genre: "demande" }>;
      if (ancienne.demande.statut === demande.statut) {
        return precedents.map((element) =>
          element.genre === "demande" && element.demande.id === demande.id ? { ...element, demande } : element,
        );
      }
      const misesAJour = precedents.map((element) =>
        element.genre === "demande" && element.demande.id === demande.id ? { ...element, demande } : element,
      );
      const discussionAvancee = derniere < precedents.length - 1 - ELEMENTS_VISIBLES_APRES_CARTE;
      // La confirmation par le client se voit sur place ; la décision ou la réponse de la réception est reprise en bas
      const decisionReception = demande.statut === "TERMINEE" || demande.declinee;
      return discussionAvancee && decisionReception
        ? [
            ...misesAJour,
            {
              genre: "demande",
              id: `${demande.id}-${demande.statut}`,
              demande,
              rappel: true,
            },
          ]
        : misesAJour;
    });
  }, []);

  // L'équipe a écrit au client (explication d'une annulation…) : Lalla le transmet dans le fil.
  // La réponse à une question, elle, s'affiche dans la carte de la question.
  const integrerMessagesEquipe = useCallback(
    (demande: DemandeVue) => {
      if (demande.type === "QUESTION" || demande.messagesEquipe.length === 0) return;
      setElements((precedents) => {
        const nouveaux = demande.messagesEquipe.filter(
          (message) => !precedents.some((element) => element.id === message.messageId),
        );
        if (nouveaux.length === 0) return precedents;
        return [
          ...precedents,
          ...nouveaux.map((message): ElementFil => ({
            genre: "assistant",
            id: message.messageId,
            texte: message.traductions[langue] ?? Object.values(message.traductions)[0] ?? message.original,
            idsMessages: [message.messageId],
            envoyeLe: new Date().toISOString(),
            // L'explication d'une annulation est rédigée par Lalla elle-même
            equipe: message.auteur === "equipe",
          })),
        ];
      });
    },
    [langue],
  );

  const envoyer = useCallback(
    async (texte: string) => {
      if (envoiEnCours.current) return;
      envoiEnCours.current = true;
      setEnCours(true);
      setAttenteReponse(true);
      setElements((precedents) => [
        ...precedents,
        {
          genre: "client",
          id: identifiantLocal(),
          texte,
          envoyeLe: new Date().toISOString(),
        },
      ]);

      // Bulle de l'assistant en cours d'écriture ; null après une carte → nouvelle bulle
      let bulleCourante: string | null = null;
      // Un tour complet se termine par « fin » : sans elle, la réponse a été coupée en route
      let termine = false;

      const traiter = (evenement: EvenementFlux) => {
        switch (evenement.type) {
          case "conversation":
            conversationId.current = evenement.id;
            ecrireStockage(cleStockage, evenement.id);
            break;
          case "texte": {
            setAttenteReponse(false);
            if (bulleCourante === null) {
              const id = identifiantLocal();
              bulleCourante = id;
              const premierMorceau = evenement.delta.trimStart();
              setElements((precedents) => [
                ...precedents,
                {
                  genre: "assistant",
                  id,
                  texte: premierMorceau,
                  idsMessages: [],
                  envoyeLe: new Date().toISOString(),
                },
              ]);
            } else {
              const id = bulleCourante;
              setElements((precedents) =>
                precedents.map((element) =>
                  element.genre === "assistant" && element.id === id
                    ? { ...element, texte: element.texte + evenement.delta }
                    : element,
                ),
              );
            }
            break;
          }
          case "messageEnregistre": {
            // Le texte écrit dans la bulle courante existe désormais en base
            const id = bulleCourante;
            if (id === null) break;
            setElements((precedents) =>
              precedents.map((element) =>
                element.genre === "assistant" && element.id === id
                  ? {
                      ...element,
                      idsMessages: [...element.idsMessages, evenement.id],
                    }
                  : element,
              ),
            );
            break;
          }
          case "demande": {
            bulleCourante = null;
            // Carte déjà affichée (annulée depuis la conversation, par exemple) : mise à jour sur place
            const { demande } = evenement;
            setElements((precedents) =>
              precedents.some((element) => element.genre === "demande" && element.id === demande.id)
                ? precedents.map((element) =>
                    element.genre === "demande" && element.id === demande.id ? { ...element, demande } : element,
                  )
                : [...precedents, { genre: "demande", id: demande.id, demande }],
            );
            break;
          }
          case "avis":
            bulleCourante = null;
            setElements((precedents) =>
              precedents.some((element) => element.genre === "avis")
                ? precedents
                : [...precedents, { genre: "avis", id: identifiantLocal() }],
            );
            break;
          case "fin":
            termine = true;
            break;
          case "erreur":
            throw new Error("indisponible");
        }
      };

      try {
        const reponse = await fetch("/api/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeton,
            conversationId: conversationId.current,
            message: texte,
            langue,
          }),
        });
        if (!reponse.ok || !reponse.body) throw new Error(`HTTP ${reponse.status}`);

        const lecteur = reponse.body.pipeThrough(new TextDecoderStream()).getReader();
        let tampon = "";
        for (;;) {
          const { value, done } = await lecteur.read();
          if (done) break;
          tampon += value;
          const lignes = tampon.split("\n");
          tampon = lignes.pop() ?? "";
          for (const ligne of lignes) if (ligne.trim()) traiter(JSON.parse(ligne) as EvenementFlux);
        }
        if (!termine) throw new TypeError("Réponse interrompue");
      } catch (erreur) {
        const cle = erreur instanceof TypeError ? "erreurReseau" : "erreurIndisponible";
        setElements((precedents) => [
          ...precedents,
          {
            genre: "erreur",
            id: identifiantLocal(),
            cle,
            messageARenvoyer: texte,
          },
        ]);
      } finally {
        envoiEnCours.current = false;
        setAttenteReponse(false);
        setEnCours(false);
      }
    },
    [jeton, langue, cleStockage],
  );

  const reessayer = useCallback(
    (idErreur: string, message: string) => {
      // On retire l'erreur et le message initial, puis on renvoie
      setElements((precedents) => {
        const rang = precedents.findIndex((element) => element.id === idErreur);
        const avant = precedents.slice(0, rang);
        const dernierClient = avant.findLastIndex((element) => element.genre === "client");
        return dernierClient === -1 ? avant : avant.slice(0, dernierClient);
      });
      envoyer(message);
    },
    [envoyer],
  );

  const deciderDemande = useCallback(
    async (id: string, decision: "confirmer" | "annuler"): Promise<boolean> => {
      try {
        const reponse = await fetch(`/api/demandes/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeton, decision }),
        });
        if (!reponse.ok) return false;
        const { demande } = (await reponse.json()) as { demande: DemandeVue };
        navigator.vibrate?.(12); // retour haptique discret
        remplacerDemande(demande);
        return true;
      } catch {
        return false;
      }
    },
    [jeton, remplacerDemande],
  );

  /**
   * Panier ou service courant envoyé sans passer par Lalla : la carte s'ajoute au fil
   * aussitôt (commande déjà transmise, service à confirmer d'un geste).
   */
  const creerDemandeDirecte = useCallback(
    async (demandeDirecte: DemandeDirecte): Promise<ResultatDemandeDirecte> => {
      try {
        const reponse = await fetch("/api/demandes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...demandeDirecte,
            jeton,
            conversationId: conversationId.current,
            langue,
          }),
        });
        const donnees = (await reponse.json().catch(() => null)) as {
          conversationId?: string;
          demandes?: DemandeVue[];
          refuses?: ArticleRefuseVue[];
        } | null;
        if (reponse.status === 403) return { ok: false, erreur: "commandesFermees", refuses: [] };
        if (reponse.status === 400) return { ok: false, erreur: "momentInvalide", refuses: [] };
        if (reponse.status === 409)
          return {
            ok: false,
            erreur: "refusee",
            refuses: donnees?.refuses ?? [],
          };
        if (!reponse.ok || !donnees?.conversationId || !donnees.demandes) {
          return { ok: false, erreur: "reseau", refuses: [] };
        }

        conversationId.current = donnees.conversationId;
        ecrireStockage(cleStockage, donnees.conversationId);
        const nouvelles = donnees.demandes;
        setElements((precedents) => [
          ...precedents,
          ...nouvelles
            .filter((demande) => !precedents.some((element) => element.id === demande.id))
            .map((demande): ElementFil => ({
              genre: "demande",
              id: demande.id,
              demande,
            })),
        ]);
        navigator.vibrate?.(12); // retour haptique discret
        return { ok: true };
      } catch {
        return { ok: false, erreur: "reseau", refuses: [] };
      }
    },
    [jeton, langue, cleStockage],
  );

  /** Traduit les réponses déjà affichées dans la nouvelle langue du client. */
  const traduireFil = useCallback(
    async (nouvelleLangue: string) => {
      const id = conversationId.current;
      const ids = elements.flatMap((element) => (element.genre === "assistant" ? element.idsMessages : []));
      if (!id || ids.length === 0) return;

      setTraductionEnCours(true);
      try {
        const reponse = await fetch("/api/conversation/traduire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeton,
            conversationId: id,
            langue: nouvelleLangue,
            ids: ids.slice(-60),
          }),
        });
        if (!reponse.ok) return;
        const { traductions } = (await reponse.json()) as {
          traductions: Record<string, string>;
        };
        setElements((precedents) =>
          precedents.map((element) => {
            if (element.genre !== "assistant" || element.idsMessages.length === 0) return element;
            if (!element.idsMessages.every((idMessage) => traductions[idMessage])) return element;
            return {
              ...element,
              texte: element.idsMessages.map((idMessage) => traductions[idMessage]).join("\n\n"),
            };
          }),
        );
      } catch {
        // Hors ligne : le fil reste dans la langue précédente, les nouvelles réponses suivront la nouvelle
      } finally {
        setTraductionEnCours(false);
      }
    },
    [elements, jeton],
  );

  // Suivi en direct des demandes transmises, en pause quand l'onglet est masqué
  const idsSuivis = elements
    .filter(
      (element): element is Extract<ElementFil, { genre: "demande" }> =>
        element.genre === "demande" && ["CONFIRMEE", "PRISE_EN_CHARGE"].includes(element.demande.statut),
    )
    .map((element) => element.demande.id)
    .join(",");

  useEffect(() => {
    if (!idsSuivis) return;
    const actualiser = async () => {
      if (document.hidden) return;
      try {
        const reponse = await fetch(`/api/demandes?jeton=${encodeURIComponent(jeton)}&ids=${idsSuivis}`);
        if (!reponse.ok) return;
        const { demandes } = (await reponse.json()) as {
          demandes: DemandeVue[];
        };
        demandes.forEach((demande) => {
          remplacerDemande(demande);
          integrerMessagesEquipe(demande);
        });
      } catch {
        // Réseau instable : prochaine tentative au prochain intervalle
      }
    };
    const minuterie = setInterval(actualiser, INTERVALLE_SUIVI_MS);
    // De retour sur l'onglet, le client voit aussitôt ce qui a changé pendant son absence
    const auRetour = () => {
      if (!document.hidden) void actualiser();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [idsSuivis, jeton, remplacerDemande, integrerMessagesEquipe]);

  return {
    elements,
    changementsEtat,
    enCours,
    attenteReponse,
    traductionEnCours,
    prechauffer,
    envoyer,
    reessayer,
    deciderDemande,
    creerDemandeDirecte,
    traduireFil,
  };
}
