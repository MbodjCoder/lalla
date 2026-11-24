"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServiceDirect } from "@/lib/services-directs";
import { variablesCouleurs } from "@/lib/couleurs";
import { variablesFenetre, variablesTypographie, type Typographie } from "@/lib/typographie";
import { traducteurClient } from "@/lib/i18n/client";
import { estLangueClient, FICHES_LANGUES, LANGUE_PAR_DEFAUT, LANGUES_CLIENT, type LangueClient } from "@/lib/langues";
import { deverrouillerSon, jouerNotification } from "@/lib/son-notification";
import type { CategorieVue, InfosPratiquesVue } from "@/lib/types";
import { Accueil } from "./Accueil";
import { CarteAvis } from "./CarteAvis";
import { Compositeur, type CommandesCompositeur } from "./Compositeur";
import { EnTete } from "./EnTete";
import { FeuilleActivites } from "./FeuilleActivites";
import { FeuilleInfos } from "./FeuilleInfos";
import { FeuilleRoomService } from "./FeuilleRoomService";
import { FeuilleRubriques } from "./FeuilleRubriques";
import { FeuilleServices } from "./FeuilleServices";
import { Fil } from "./Fil";
import { useNotifications, type NotificationClient } from "./notifications";
import { PanneauNotifications } from "./PanneauNotifications";
import type { IdRubrique } from "./rubriques";
import { SelecteurLangue } from "./SelecteurLangue";
import { useConversation, type DemandeDirecte } from "./useConversation";

type Proprietes = {
  jeton: string;
  hotel: {
    nom: string;
    sousTitre: string | null;
    logoUrl: string | null;
    ville: string;
    nomAssistant: string;
    couleurAccent: string;
    couleurMessages: string | null;
    couleurFond: string | null;
    couleurHoraires: string | null;
    couleurIcones: string | null;
    couleurMessagesClient: string | null;
    couleurBoutons: string | null;
    devise: string;
    typographie: Typographie; // police, taille et couleur des textes, réglées par la direction
  };
  infos: InfosPratiquesVue;
  numeroChambre: string;
  carte: CategorieVue[];
  avisAttendu: boolean;
};

// Feuille ouverte par-dessus la conversation (une seule à la fois)
type Feuille = IdRubrique | "rubriques" | "notifications" | null;

// Répartition de la carte entre les feuilles
const TYPES_ROOM_SERVICE = ["RESTAURATION"];
const TYPES_ACTIVITES = ["EXPERIENCE", "BIEN_ETRE"];

const CLE_LANGUE = "lalla:langue";
// Fond de l'en-tête, prolongé derrière la barre du navigateur
const COULEUR_EN_TETE = "#ffffff";
// En dessous de cette distance du bas, le fil suit automatiquement les nouveaux messages
const SEUIL_SUIVI_PX = 160;
// Durée de la mise en évidence d'une carte ouverte depuis les notifications
const DUREE_SURLIGNAGE_MS = 1800;

// Première visite : la langue du téléphone, si Lalla la parle
function langueDuTelephone(): LangueClient | null {
  const codes = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const code of codes) {
    const langue = code.slice(0, 2).toLowerCase();
    if ((LANGUES_CLIENT as readonly string[]).includes(langue)) return langue as LangueClient;
  }
  return null;
}

function lireLangueMemorisee(): LangueClient | null {
  try {
    const valeur = localStorage.getItem(CLE_LANGUE);
    return estLangueClient(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

export function Concierge({ jeton, hotel, infos, numeroChambre, carte, avisAttendu }: Proprietes) {
  // Français par défaut ; le choix du client est mémorisé sur son téléphone
  const [langue, setLangue] = useState<LangueClient>(LANGUE_PAR_DEFAUT);
  const [feuille, setFeuille] = useState<Feuille>(null);
  const [languesOuvertes, setLanguesOuvertes] = useState(false);
  const t = useMemo(() => traducteurClient(langue), [langue]);
  const conversation = useConversation({ jeton, langue, avisAttendu });
  const zoneDefilement = useRef<HTMLElement>(null);
  const compositeur = useRef<CommandesCompositeur>(null);
  const suiviAutomatique = useRef(true);
  const reponseAttendue = useRef(false);
  const sens = FICHES_LANGUES[langue].sens;
  const notifications = useNotifications(jeton, conversation.elements);
  // Non lues au moment d'ouvrir la liste : elles y gardent leur point
  const [nonLuesOuverture, setNonLuesOuverture] = useState<ReadonlySet<string>>(new Set());
  const [carteSurlignee, setCarteSurlignee] = useState<string | null>(null);

  const categoriesRoomService = useMemo(
    () => carte.filter((categorie) => TYPES_ROOM_SERVICE.includes(categorie.type)),
    [carte],
  );
  // Excursions, horaires et transferts : seulement ce qui est disponible aujourd'hui
  const carteDisponible = useMemo(
    () =>
      carte
        .map((categorie) => ({
          ...categorie,
          articles: categorie.articles.filter((article) => article.disponible),
        }))
        .filter((categorie) => categorie.articles.length > 0),
    [carte],
  );
  const categoriesActivites = useMemo(
    () => TYPES_ACTIVITES.flatMap((type) => carteDisponible.filter((categorie) => categorie.type === type)),
    [carteDisponible],
  );

  // Les navigateurs n'autorisent le son qu'après un premier geste
  useEffect(() => {
    window.addEventListener("pointerdown", deverrouillerSon, { once: true });
    return () => window.removeEventListener("pointerdown", deverrouillerSon);
  }, []);

  // Chaque changement d'état d'une carte (transmise, acceptée, annulée, répondue) : la sonnette
  useEffect(() => {
    if (conversation.changementsEtat > 0) jouerNotification();
  }, [conversation.changementsEtat]);

  // Chaque réponse de Lalla sonne aussi, dès ses premiers mots
  useEffect(() => {
    if (conversation.attenteReponse) reponseAttendue.current = true;
    else if (reponseAttendue.current) {
      reponseAttendue.current = false;
      if (conversation.elements.at(-1)?.genre !== "erreur") jouerNotification();
    }
  }, [conversation.attenteReponse, conversation.elements]);

  useEffect(() => {
    const choisie = lireLangueMemorisee() ?? langueDuTelephone();
    if (choisie) setLangue(choisie);
  }, []);

  // Bords de l'écran : en haut, le blanc de l'en-tête (barre du navigateur, rebond du défilement) ;
  // en bas, le fond de l'hôtel
  useEffect(() => {
    const fond = getComputedStyle(document.querySelector<HTMLElement>("[data-concierge]")!).backgroundColor;
    document.body.style.background = `linear-gradient(${COULEUR_EN_TETE} 50%, ${fond} 50%)`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COULEUR_EN_TETE);
  }, [hotel.couleurFond]);

  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dir = sens;
  }, [langue, sens]);

  const { traduireFil } = conversation;
  const choisirLangue = useCallback(
    (nouvelle: LangueClient) => {
      setLanguesOuvertes(false);
      if (nouvelle === langue) return;
      setLangue(nouvelle);
      try {
        localStorage.setItem(CLE_LANGUE, nouvelle);
      } catch {}
      // Les réponses déjà affichées suivent : tout l'écran parle la même langue
      traduireFil(nouvelle);
    },
    [langue, traduireFil],
  );

  // Défilement : suivre le bas du fil sauf si le client est remonté lire
  useEffect(() => {
    const zone = zoneDefilement.current;
    if (!zone || !suiviAutomatique.current || conversation.elements.length === 0) return;
    zone.scrollTo({
      top: zone.scrollHeight,
      behavior: conversation.enCours ? "auto" : "smooth",
    });
  }, [conversation.elements, conversation.attenteReponse, conversation.enCours]);

  const surDefilement = () => {
    const zone = zoneDefilement.current;
    if (!zone) return;
    suiviAutomatique.current = zone.scrollHeight - zone.scrollTop - zone.clientHeight < SEUIL_SUIVI_PX;
  };

  const { envoyer: envoyerMessage } = conversation;
  const envoyer = useCallback(
    (texte: string) => {
      suiviAutomatique.current = true;
      envoyerMessage(texte);
    },
    [envoyerMessage],
  );

  const fermerFeuille = useCallback(() => setFeuille(null), []);

  const { marquerVues } = notifications;
  const ouvrirNotifications = () => {
    setNonLuesOuverture(
      new Set(notifications.notifications.filter(({ id }) => !notifications.vues.includes(id)).map(({ id }) => id)),
    );
    marquerVues();
    setFeuille("notifications");
  };

  // Une notification touchée : sa carte (la plus récente, si elle a été reprise en bas) vient au
  // centre de l'écran et s'éclaire un instant ; le fil cesse de suivre le bas le temps de la lire
  const ouvrirNotification = useCallback((notification: NotificationClient) => {
    setFeuille(null);
    suiviAutomatique.current = false;
    const cartes = document.querySelectorAll<HTMLElement>(`[data-carte="${CSS.escape(notification.demande.id)}"]`);
    cartes[cartes.length - 1]?.scrollIntoView({ block: "center", behavior: "smooth" });
    setCarteSurlignee(notification.demande.id);
  }, []);

  useEffect(() => {
    if (!carteSurlignee) return;
    const minuteur = setTimeout(() => setCarteSurlignee(null), DUREE_SURLIGNAGE_MS);
    return () => clearTimeout(minuteur);
  }, [carteSurlignee]);
  const fermerLangues = useCallback(() => setLanguesOuvertes(false), []);
  const filVide = conversation.elements.length === 0;

  // Un choix fait dans une feuille devient un message à Lalla
  const demander = useCallback(
    (message: string) => {
      setFeuille(null);
      envoyer(message);
    },
    [envoyer],
  );

  // Panier envoyé, ou service courant demandé d'un geste : la carte arrive aussitôt dans le fil
  const { creerDemandeDirecte } = conversation;
  const demanderDirectement = useCallback(
    async (demande: DemandeDirecte) => {
      const resultat = await creerDemandeDirecte(demande);
      if (resultat.ok) {
        suiviAutomatique.current = true;
        setFeuille(null);
      }
      return resultat;
    },
    [creerDemandeDirecte],
  );

  // Service d'un geste ; hors ligne ou commandes fermées, Lalla prend le relais et explique
  const demanderService = useCallback(
    async (service: ServiceDirect, message: string) => {
      const resultat = await demanderDirectement({ genre: "service", service });
      if (!resultat.ok) demander(message);
    },
    [demanderDirectement, demander],
  );

  // Rubrique sans rien à montrer (carte vide) : Lalla prend le relais
  const ouvrirRubrique = useCallback(
    (rubrique: IdRubrique) => {
      if (rubrique === "roomService" && categoriesRoomService.length === 0) return demander(t("sugRoomServiceMessage"));
      if (rubrique === "activites" && categoriesActivites.length === 0) return demander(t("tuileActivitesMessage"));
      setFeuille(rubrique);
    },
    [categoriesRoomService, categoriesActivites, demander, t],
  );

  return (
    <div
      data-concierge
      dir={sens}
      lang={langue}
      className="flex h-dvh flex-col bg-fond"
      style={{ ...variablesCouleurs(hotel), ...variablesTypographie(hotel.typographie, "client") }}
    >
      <EnTete
        t={t}
        hotel={hotel}
        notificationsNonLues={notifications.nonLues}
        onOuvrirNotifications={ouvrirNotifications}
        onOuvrirMenu={() => setFeuille("rubriques")}
      />

      <main ref={zoneDefilement} onScroll={surDefilement} className="flex-1 overflow-y-auto overscroll-contain">
        <div className={`mx-auto max-w-xl px-5 ${filVide ? "h-full" : ""}`}>
          {filVide ? (
            <Accueil
              t={t}
              onOuvrirRubrique={ouvrirRubrique}
              carteAvis={avisAttendu ? <CarteAvis jeton={jeton} langue={langue} t={t} departProche compacte /> : null}
            />
          ) : (
            <Fil
              elements={conversation.elements}
              attenteReponse={conversation.attenteReponse}
              traductionEnCours={conversation.traductionEnCours}
              jeton={jeton}
              devise={hotel.devise}
              fuseau={infos.fuseauHoraire}
              telephoneReception={infos.telephoneReception}
              nomAssistant={hotel.nomAssistant}
              departProche={avisAttendu}
              carteSurlignee={carteSurlignee}
              langue={langue}
              t={t}
              onDeciderDemande={conversation.deciderDemande}
              onReessayer={conversation.reessayer}
            />
          )}
        </div>
      </main>

      <Compositeur
        ref={compositeur}
        jeton={jeton}
        t={t}
        langue={langue}
        desactive={conversation.enCours}
        onEnvoyer={envoyer}
        onSaisie={conversation.prechauffer}
      />

      {feuille === "notifications" && (
        <PanneauNotifications
          notifications={notifications.notifications}
          nonLues={nonLuesOuverture}
          langue={langue}
          t={t}
          onFermer={fermerFeuille}
          onOuvrir={ouvrirNotification}
        />
      )}
      <FeuilleRubriques
        ouverte={feuille === "rubriques"}
        ville={hotel.ville}
        langue={langue}
        t={t}
        onFermer={fermerFeuille}
        onChoisir={ouvrirRubrique}
        onChoisirLangue={() => {
          setFeuille(null);
          setLanguesOuvertes(true);
        }}
      />
      <FeuilleRoomService
        ouverte={feuille === "roomService"}
        variablesTextes={variablesFenetre(hotel.typographie, "repas")}
        categories={categoriesRoomService}
        devise={hotel.devise}
        fuseau={infos.fuseauHoraire}
        langue={langue}
        t={t}
        onFermer={fermerFeuille}
        onCommander={(lignes) => demanderDirectement({ genre: "commande", lignes })}
      />
      <FeuilleServices
        ouverte={feuille === "services"}
        variablesTextes={variablesFenetre(hotel.typographie, "services")}
        fuseau={infos.fuseauHoraire}
        langue={langue}
        t={t}
        onFermer={fermerFeuille}
        onService={demanderService}
        onDemanderDirect={demanderDirectement}
        onAutre={() => {
          compositeur.current?.ecrireDemande();
          setFeuille(null);
        }}
      />
      <FeuilleActivites
        ouverte={feuille === "activites"}
        variablesTextes={variablesFenetre(hotel.typographie, "activites")}
        categories={categoriesActivites}
        ville={hotel.ville}
        devise={hotel.devise}
        fuseau={infos.fuseauHoraire}
        langue={langue}
        t={t}
        onFermer={fermerFeuille}
        onReserver={demanderDirectement}
      />
      <FeuilleInfos
        ouverte={feuille === "infos"}
        variablesTextes={variablesFenetre(hotel.typographie, "infos")}
        infos={infos}
        categories={carteDisponible}
        nomAssistant={hotel.nomAssistant}
        langue={langue}
        t={t}
        onFermer={fermerFeuille}
        onService={demanderService}
      />

      <SelecteurLangue
        ouvert={languesOuvertes}
        langue={langue}
        t={t}
        onChoisir={choisirLangue}
        onFermer={fermerLangues}
      />
    </div>
  );
}
