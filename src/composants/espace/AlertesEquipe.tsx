"use client";

import { BellRing, MessageCircleQuestion, Star, Wrench } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AlerteEquipe } from "@/lib/alertes-equipe";
import { deverrouillerSon, jouerAlerte } from "@/lib/son-notification";

type Libelles = {
  nouvelleDemande: string;
  nouvelleQuestion: string;
  nouveauSignalement: string;
  avisDecevant: string;
  autresAlertes: { une: string; plusieurs: string }; // « +{n} autre » / « +{n} autres »
  chambre: string;
};

type Proprietes = {
  alertesInitiales: AlerteEquipe[];
  titrePage: string;
  libelles: Libelles;
};

const INTERVALLE_MS = 5000;
const DUREE_BANDEAU_MS = 7000;
// Les navigateurs n'autorisent le son qu'après un geste : le premier, quel qu'il soit, le débloque
const GESTES = ["pointerdown", "keydown", "touchstart"] as const;

// Veille de l'espace hôtel, présente sur toutes ses pages : chaque nouvelle alerte
// sonne brièvement (son actif par défaut) et s'affiche en bandeau.
export function AlertesEquipe({ alertesInitiales, titrePage, libelles }: Proprietes) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [alertes, setAlertes] = useState(alertesInitiales);
  // Bandeau : l'alerte la plus importante parmi les nouvelles, et combien d'autres l'accompagnent
  const [bandeau, setBandeau] = useState<{
    alerte: AlerteEquipe;
    autres: number;
  } | null>(null);
  const vues = useRef(new Set(alertesInitiales.map((alerte) => alerte.id)));
  const empreinte = useRef(alertesInitiales.map((alerte) => alerte.id).join());

  useEffect(() => {
    // Déjà autorisé si le navigateur fait confiance au site ; sinon, dès le premier geste
    void deverrouillerSon();
    const surGeste = () => {
      void deverrouillerSon().then((autorise) => {
        if (autorise) GESTES.forEach((geste) => window.removeEventListener(geste, surGeste));
      });
    };
    GESTES.forEach((geste) => window.addEventListener(geste, surGeste));
    return () => GESTES.forEach((geste) => window.removeEventListener(geste, surGeste));
  }, []);

  // Interrogation régulière (en pause quand l'onglet est masqué)
  useEffect(() => {
    const interroger = async () => {
      if (document.hidden) return;
      try {
        const reponse = await fetch("/api/espace/alertes", {
          cache: "no-store",
        });
        if (!reponse.ok) return;
        const { alertes: recues } = (await reponse.json()) as {
          alertes: AlerteEquipe[];
        };
        const nouvelles = recues.filter((alerte) => !vues.current.has(alerte.id));
        nouvelles.forEach((alerte) => vues.current.add(alerte.id));
        if (nouvelles.length > 0) {
          jouerAlerte();
          // La liste arrive déjà triée : urgences d'abord, puis la plus ancienne
          setBandeau({ alerte: nouvelles[0], autres: nouvelles.length - 1 });
        }
        setAlertes(recues);
        const nouvelleEmpreinte = recues.map((alerte) => alerte.id).join();
        if (nouvelleEmpreinte !== empreinte.current) {
          empreinte.current = nouvelleEmpreinte;
          routeur.refresh(); // la page affichée reflète aussitôt le changement
        }
      } catch {}
    };
    const minuterie = setInterval(interroger, INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [routeur]);

  useEffect(() => {
    document.title = alertes.length > 0 ? `(${alertes.length}) ${titrePage}` : titrePage;
  }, [alertes, titrePage, chemin]);

  useEffect(() => {
    if (!bandeau) return;
    const minuteur = setTimeout(() => setBandeau(null), DUREE_BANDEAU_MS);
    return () => clearTimeout(minuteur);
  }, [bandeau]);

  return (
    <>
      {bandeau && (
        <button
          type="button"
          onClick={() => {
            setBandeau(null);
            const { genre, nature } = bandeau.alerte;
            routeur.push(
              `/espace/accueil?page=${genre === "avis" ? "avis" : nature === "QUESTION" ? "questions" : "commandes"}`,
            );
          }}
          className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-sm animate-apparition items-center gap-2.5 rounded-2xl bg-encre py-2 ps-2 pe-3.5 text-start text-white shadow-flottante"
        >
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-xl ${bandeau.alerte.urgent ? "bg-alerte" : "bg-white/12"}`}
            aria-hidden
          >
            <IconeAlerte nature={bandeau.alerte.nature} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="texte-libelles-equipe block truncate">
              {titreAlerte(bandeau.alerte, libelles)} · {libelles.chambre} {bandeau.alerte.chambre}
            </span>
            <span className="texte-courant-equipe mt-0.5 block truncate text-white/70">{bandeau.alerte.resume}</span>
          </span>
          {bandeau.autres > 0 && (
            <span className="texte-etiquettes-equipe shrink-0 rounded-full bg-white/12 px-2 py-0.5 tabular-nums">
              {(bandeau.autres === 1 ? libelles.autresAlertes.une : libelles.autresAlertes.plusieurs).replace(
                "{n}",
                String(bandeau.autres),
              )}
            </span>
          )}
        </button>
      )}
    </>
  );
}

function titreAlerte(alerte: AlerteEquipe, libelles: Libelles): string {
  switch (alerte.nature) {
    case "AVIS":
      return libelles.avisDecevant;
    case "QUESTION":
      return libelles.nouvelleQuestion;
    case "INCIDENT":
      return libelles.nouveauSignalement;
    default:
      return libelles.nouvelleDemande;
  }
}

function IconeAlerte({ nature }: { nature: AlerteEquipe["nature"] }) {
  if (nature === "AVIS") return <Star className="size-4" />;
  if (nature === "QUESTION") return <MessageCircleQuestion className="size-4" />;
  if (nature === "INCIDENT") return <Wrench className="size-4" />;
  return <BellRing className="size-4" />;
}
