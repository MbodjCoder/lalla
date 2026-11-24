// Le contenu d'une page temporaire de l'accueil : commandes (et demandes de service, signalements),
// questions ou avis. Lalla s'occupe des clients ; ici remonte ce qui attend l'équipe, la plus
// récente en haut. Une action par ligne ; le travail terminé se replie dessous.
import {
  Check,
  ChevronDown,
  ConciergeBell,
  History,
  Languages,
  MessageCircleQuestion,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AvisClients } from "@/composants/espace/AvisClients";
import { ZonePage } from "@/composants/espace/ZonePage";
import { ActionsDemande } from "@/composants/espace/ActionsDemande";
import { libellesActionsEquipe } from "@/composants/espace/libelles-actions";
import { LigneOuvrable } from "@/composants/espace/LigneOuvrable";
import {
  IconeService,
  LIGNE_DEMANDE,
  LIGNE_DEMANDE_URGENTE,
  LISTE_DEMANDES,
  LigneAvis,
  NUMERO,
  PASTILLE_ROUGE,
  PastilleAttente,
  TITRE,
} from "@/composants/espace/lignes";
import { RechercheDepliable } from "@/composants/espace/RechercheDepliable";
import { filtreDemandesATraiter, filtreDemandesExpirees } from "@/lib/alertes-equipe";
import {
  attente,
  normaliser,
  SEUIL_RETARD_MIN,
  SEUIL_RETARD_URGENT_MIN,
  type Attente,
  type Horloge,
} from "@/lib/attente";
import { bdd } from "@/lib/bdd";
import { lireHotel } from "@/lib/hotel-courant";
import { versVue } from "@/lib/demandes";
import { formaterPrix } from "@/lib/format";
import { cleDepartement, cleType, type TraduireEquipe } from "@/lib/i18n/equipe";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { choisirTraduction, estLangueClient, FICHES_LANGUES, nomDeLangue, type LangueEquipe } from "@/lib/langues";
import { exigerPersonnel } from "@/lib/session-personnel";
import type { DemandeVue, TypeDemandeVue } from "@/lib/types";
import { deciderCommandeDepuisEspace, repondreQuestionDepuisEspace } from "@/app/espace/actions";

const ICONES_TYPE: Record<TypeDemandeVue, LucideIcon> = {
  COMMANDE: UtensilsCrossed,
  SERVICE: ConciergeBell,
  INCIDENT: Wrench,
  QUESTION: MessageCircleQuestion,
};

// Historique : le travail terminé aujourd'hui et les demandes expirées de la semaine ; une recherche remonte plus loin
const HISTORIQUE_MAX = 50;
const HISTORIQUE_RECHERCHE_MAX = 200;
const EXPIREES_DEPUIS_MS = 7 * 24 * 3600 * 1000;

const inclusionDemande = {
  lignes: true,
  chambre: true,
  sejour: { select: { nomClient: true } },
} as const;

// Onglets : chaque sorte de notification
export const VUES_NOTIFICATIONS = ["commandes", "questions", "avis"] as const;
export type VueNotifications = (typeof VUES_NOTIFICATIONS)[number];

export async function ContenuNotifications({ vue, h }: { vue: VueNotifications; h?: string }) {
  const session = await exigerPersonnel();
  const { hotelId } = session;
  const hotel = await lireHotel(hotelId);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);
  const horloge: Horloge = {
    locale: FICHES_LANGUES[langue].locale,
    fuseau: hotel.fuseauHoraire,
  };
  const maintenant = new Date();

  // Début de la journée de l'hôtel (hôtels sénégalais : UTC+0)
  const jourHotel = new Intl.DateTimeFormat("en-CA", {
    timeZone: hotel.fuseauHoraire,
  }).format(maintenant);
  const debutJour = new Date(`${jourHotel}T00:00:00Z`);

  const recherche = normaliser(h?.trim() ?? "");

  const [demandes, terminees, expirees] = await Promise.all([
    bdd.demande.findMany({
      where: filtreDemandesATraiter(hotelId, maintenant),
      include: inclusionDemande,
    }),
    bdd.demande.findMany({
      where: {
        hotelId,
        statut: "TERMINEE",
        ...(recherche ? {} : { termineeLe: { gte: debutJour } }),
      },
      include: inclusionDemande,
      orderBy: { termineeLe: "desc" },
      take: recherche ? HISTORIQUE_RECHERCHE_MAX : HISTORIQUE_MAX,
    }),
    bdd.demande.findMany({
      where: {
        ...filtreDemandesExpirees(hotelId, maintenant),
        ...(recherche
          ? {}
          : {
              creeLe: {
                gte: new Date(maintenant.getTime() - EXPIREES_DEPUIS_MS),
              },
            }),
      },
      include: inclusionDemande,
      orderBy: { creeLe: "desc" },
      take: recherche ? HISTORIQUE_RECHERCHE_MAX : HISTORIQUE_MAX,
    }),
  ]);

  // La file de l'onglet : les urgences devant (sécurité), puis la plus récente en haut
  const file = demandes
    .filter((demande) => (vue === "questions" ? demande.type === "QUESTION" : demande.type !== "QUESTION"))
    .map((demande) => ({ demande, urgent: demande.urgent, depuis: demande.confirmeeLe ?? demande.creeLe }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.depuis.getTime() - a.depuis.getTime());
  const seuil = (urgent: boolean) => (urgent ? SEUIL_RETARD_URGENT_MIN : SEUIL_RETARD_MIN);

  // Historique : terminées et expirées, les plus récentes en haut ; la recherche porte sur la chambre,
  // le client et le contenu de la demande (dans toutes ses langues)
  const correspond = (demande: (typeof terminees)[number]) =>
    !recherche ||
    normaliser(
      [
        demande.chambre.numero,
        demande.sejour?.nomClient,
        demande.resume,
        demande.details,
        JSON.stringify(demande.traductions),
        ...demande.lignes.map((ligne) => `${ligne.libelle} ${JSON.stringify(ligne.traductions)}`),
      ]
        .filter(Boolean)
        .join(" "),
    ).includes(recherche);
  const deLOnglet = (demande: (typeof terminees)[number]) =>
    vue === "questions" ? demande.type === "QUESTION" : demande.type !== "QUESTION";
  const historique = [
    ...terminees.map((demande) => ({
      demande,
      expiree: false,
      le: demande.termineeLe!,
    })),
    ...expirees.map((demande) => ({
      demande,
      expiree: true,
      le: demande.confirmeeLe ?? demande.creeLe,
    })),
  ]
    .filter(({ demande }) => deLOnglet(demande) && correspond(demande))
    .sort((a, b) => b.le.getTime() - a.le.getTime());
  const termineesAujourdhui = terminees.filter(
    (demande) => deLOnglet(demande) && demande.termineeLe! >= debutJour,
  ).length;
  const heureFin = (date: Date) =>
    new Intl.DateTimeFormat(horloge.locale, {
      timeZone: horloge.fuseau,
      hour: "2-digit",
      minute: "2-digit",
      ...(new Intl.DateTimeFormat("en-CA", { timeZone: horloge.fuseau }).format(date) === jourHotel
        ? {}
        : { day: "numeric", month: "short" }),
    }).format(date);

  return (
    <ZonePage page="notifications">
      {vue === "avis" ? (
        <div>
          <AvisClients
            hotelId={hotelId}
            avisConsultesLe={hotel.avisConsultesLe}
            h={h}
            langue={langue}
            horloge={horloge}
            t={t}
          />
        </div>
      ) : (
        <>
          {file.length === 0 ? (
            <p className="texte-textes-equipe rounded-[24px] border border-ligne bg-surface px-6 py-8 text-center text-textes-equipe shadow-carte">
              {t("toutEstCalmeTexte", { assistant: hotel.nomAssistant })}
            </p>
          ) : (
            <ul className={LISTE_DEMANDES}>
              {file.map(({ demande, urgent, depuis }) => (
                <LigneDemande
                  key={demande.id}
                  demande={versVue(demande)}
                  numeroChambre={demande.chambre.numero}
                  nomClient={demande.sejour?.nomClient ?? null}
                  attente={attente(depuis, seuil(urgent), t, horloge)}
                  devise={hotel.devise}
                  langue={langue}
                  t={t}
                />
              ))}
            </ul>
          )}

          {/* Le travail terminé, replié sur une ligne : consultable et cherchable sans encombrer la file */}
          <details open={Boolean(recherche)} className="group mt-10">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[20px] bg-creux/70 px-4 py-3.5 transition hover:bg-creux [&::-webkit-details-marker]:hidden">
              <History className="size-5 shrink-0 text-encre-douce" strokeWidth={2} aria-hidden />
              <span className="texte-textes-equipe flex-1 text-textes-equipe">{t("historique")}</span>
              <span className="texte-details-equipe tabular-nums text-details-equipe">
                {recherche
                  ? t("resultatsHistorique", { n: historique.length })
                  : t("historiqueAujourdhui", { n: termineesAujourdhui })}
              </span>
              <ChevronDown className="size-5 shrink-0 text-encre-pale transition group-open:rotate-180" aria-hidden />
            </summary>

            <div className="mt-3 flex justify-end">
              <RechercheDepliable
                parametre="h"
                libelles={{
                  rechercher: t("rechercher"),
                  placeholder: t("rechercherHistorique"),
                  fermer: t("fermerRecherche"),
                }}
              />
            </div>

            {historique.length === 0 ? (
              <p className="texte-details-equipe mt-3 rounded-[20px] border border-dashed border-ligne px-5 py-6 text-center text-details-equipe">
                {recherche ? t("aucunResultat", { q: h?.trim() ?? "" }) : t("aucunHistorique")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {historique.map(({ demande, expiree, le }) => {
                  const vue = versVue(demande);
                  const textes = choisirTraduction(vue.textes, langue, vue.textes.fr);
                  const Icone = ICONES_TYPE[vue.type];
                  const code =
                    estLangueClient(demande.langueClient) && demande.langueClient !== langue
                      ? demande.langueClient
                      : null;
                  return (
                    <LigneOuvrable
                      key={demande.id}
                      id={demande.id}
                      className="flex items-center gap-4 rounded-[18px] border border-ligne bg-surface px-4 py-3 shadow-carte sm:px-5"
                      libelleOuvrir={t("voirDetail")}
                      libelleFermer={t("fermer")}
                      fiche={
                        <FicheDemande
                          demande={vue}
                          textes={textes}
                          numeroChambre={demande.chambre.numero}
                          nomClient={demande.sejour?.nomClient ?? null}
                          nomLangueClient={code ? nomDeLangue(code, langue) : null}
                          attente={attente(demande.confirmeeLe ?? demande.creeLe, Infinity, t, horloge)}
                          devise={hotel.devise}
                          langue={langue}
                          t={t}
                          issue={expiree ? { expiree: true } : { termineeA: heureFin(le) }}
                        />
                      }
                    >
                      <span className="texte-numeros w-11 shrink-0 text-numeros">{demande.chambre.numero}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Icone className="size-4 shrink-0 text-encre-douce" aria-label={t(cleType(vue.type))} />
                        <span className="texte-courant-equipe truncate text-courant-equipe">
                          {vue.type === "QUESTION" ? `« ${textes.resume} »` : textes.resume}
                        </span>
                      </span>
                      {expiree ? (
                        <span className="texte-etiquettes-equipe shrink-0 rounded-full bg-creux px-2.5 py-0.5 text-encre-douce">
                          {t("expiree")}
                        </span>
                      ) : (
                        <span className="texte-etiquettes-equipe inline-flex shrink-0 items-center gap-1 rounded-full bg-succes/10 px-2.5 py-0.5 tabular-nums text-succes">
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                          {attente(le, Infinity, t, horloge).heure}
                        </span>
                      )}
                    </LigneOuvrable>
                  );
                })}
              </ul>
            )}
          </details>
        </>
      )}
    </ZonePage>
  );
}

// Au repos, l'action reste à droite de la ligne ; une réponse à écrire passe dessous, sur toute la largeur
const ACTIONS = {
  className: "shrink-0",
  classeOuvert: "basis-full",
};

function LigneDemande({
  demande,
  numeroChambre,
  nomClient,
  attente,
  devise,
  langue,
  t,
}: {
  demande: DemandeVue;
  numeroChambre: string;
  nomClient: string | null;
  attente: Attente;
  devise: string;
  langue: LangueEquipe;
  t: TraduireEquipe;
}) {
  // Dans la langue de l'équipe ; à défaut, l'anglais ou le français (textes rédigés en fr + en + langue du client)
  const textes = choisirTraduction(demande.textes, langue, demande.textes.fr);
  const Icone = ICONES_TYPE[demande.type];
  const langueClient =
    estLangueClient(demande.langueClient) && demande.langueClient !== langue ? demande.langueClient : null;
  const nomLangueClient = langueClient ? nomDeLangue(langueClient, langue) : null;
  // Une commande se lit d'un coup d'œil : « 2× Thiéboudienne, 1× Bissap »
  const titre =
    demande.type === "COMMANDE" && demande.lignes.length > 0
      ? demande.lignes
          .map((ligne) => `${ligne.quantite}× ${choisirTraduction(ligne.textes, langue, ligne.textes.fr).libelle}`)
          .join(", ")
      : textes.resume;
  const remarques =
    demande.type === "COMMANDE"
      ? demande.lignes
          .flatMap((ligne) => choisirTraduction(ligne.textes, langue, ligne.textes.fr).remarque ?? [])
          .join(" · ")
      : "";
  // Une précision qui ne fait que répéter le titre n'encombre pas la ligne
  const details = textes.details && !normaliser(textes.details).includes(normaliser(titre)) ? textes.details : null;
  const precision = [remarques, details].filter(Boolean).join(" · ");

  return (
    <LigneOuvrable
      id={demande.id}
      className={`${LIGNE_DEMANDE} ${demande.urgent ? LIGNE_DEMANDE_URGENTE : ""}`}
      libelleOuvrir={t("voirDetail")}
      libelleFermer={t("fermer")}
      fiche={
        <FicheDemande
          demande={demande}
          textes={textes}
          numeroChambre={numeroChambre}
          nomClient={nomClient}
          nomLangueClient={nomLangueClient}
          attente={attente}
          devise={devise}
          langue={langue}
          t={t}
        />
      }
    >
      <span className={`${NUMERO} w-11`}>{numeroChambre}</span>
      <div className="min-w-0 flex-1">
        <p className={TITRE}>
          {demande.urgent && <span className={PASTILLE_ROUGE}>{t("urgent")}</span>}
          <span className="line-clamp-2 min-w-0">{demande.type === "QUESTION" ? `« ${titre} »` : titre}</span>
        </p>
        {precision && <p className="texte-courant-equipe truncate text-courant-equipe">{precision}</p>}
        {/* Service, heure (rouge en retard), montant, client, langue : sur une ligne discrète */}
        <p className="texte-details-equipe mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-details-equipe">
          <IconeService departement={demande.departement} question={demande.type === "QUESTION"} />
          <span>{demande.type === "QUESTION" ? t("type_QUESTION") : t(cleDepartement(demande.departement))}</span>·
          <span
            title={t("enAttenteDepuis", { duree: attente.duree })}
            className={`tabular-nums ${attente.enRetard ? "font-semibold text-alerte" : ""}`}
          >
            {attente.heure}
          </span>
          {demande.type === "COMMANDE" && demande.montantTotal > 0 && (
            <>
              ·
              <span className="font-semibold tabular-nums text-encre-douce">
                {formaterPrix(demande.montantTotal, devise, langue)}
              </span>
            </>
          )}
          {nomClient && (
            <>
              ·<span className="truncate">{nomClient}</span>
            </>
          )}
          {nomLangueClient && (
            <>
              ·
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3.5" />
                {nomLangueClient}
              </span>
            </>
          )}
        </p>
      </div>
      <ActionsDemande
        demandeId={demande.id}
        type={demande.type}
        libelles={libellesActionsEquipe(t, nomLangueClient)}
        actionDecision={deciderCommandeDepuisEspace}
        actionReponse={repondreQuestionDepuisEspace}
        {...ACTIONS}
      />
    </LigneOuvrable>
  );
}

/** Fiche détaillée d'une demande : tout ce qu'il faut savoir, et les mêmes décisions. */
function FicheDemande({
  demande,
  textes,
  numeroChambre,
  nomClient,
  nomLangueClient,
  attente,
  devise,
  langue,
  t,
  issue,
}: {
  demande: DemandeVue;
  textes: { resume: string; details: string | null };
  numeroChambre: string;
  nomClient: string | null;
  nomLangueClient: string | null;
  attente: Attente;
  devise: string;
  langue: LangueEquipe;
  t: TraduireEquipe;
  issue?: { termineeA: string } | { expiree: true }; // historique : plus de décision à prendre
}) {
  const Icone = ICONES_TYPE[demande.type];
  return (
    <>
      <p className="texte-libelles-equipe flex flex-wrap items-center gap-2 pe-12 text-libelles-equipe">
        <Icone className="size-4 shrink-0" aria-hidden />
        {t(cleType(demande.type))} · {t(cleDepartement(demande.departement))}
        {demande.urgent && <span className={PASTILLE_ROUGE}>{t("urgent")}</span>}
      </p>
      <h2 className="texte-sous-titres-equipe mt-2 leading-none text-sous-titres-equipe">
        {t("chambre")} {numeroChambre}
      </h2>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-creux/70 p-4">
        <div className="col-span-2 sm:col-span-1">
          <dt className="texte-libelles-equipe text-libelles-equipe">{t("recue")}</dt>
          <dd className="texte-courant-equipe mt-1 flex flex-wrap items-center gap-2 text-courant-equipe">
            <PastilleAttente attente={attente} t={t} />
          </dd>
        </div>
        {nomClient && (
          <div>
            <dt className="texte-libelles-equipe text-libelles-equipe">{t("client")}</dt>
            <dd className="texte-libelles-equipe mt-1 text-libelles-equipe">{nomClient}</dd>
          </div>
        )}
        {nomLangueClient && (
          <div>
            <dt className="texte-libelles-equipe text-libelles-equipe">{t("langueDuClient")}</dt>
            <dd className="texte-libelles-equipe mt-1 first-letter:uppercase text-libelles-equipe">
              {nomLangueClient}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        {demande.type === "COMMANDE" ? (
          <>
            <ul className="divide-y divide-ligne">
              {demande.lignes.map((ligne, rang) => {
                const texte = choisirTraduction(ligne.textes, langue, ligne.textes.fr);
                return (
                  <li key={rang} className="flex items-baseline gap-3 py-3 first:pt-0">
                    <span className="texte-textes-equipe w-7 shrink-0 tabular-nums text-textes-equipe">
                      {ligne.quantite}×
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="texte-textes-equipe block leading-snug text-textes-equipe">{texte.libelle}</span>
                      {texte.remarque && (
                        <span className="texte-courant-equipe mt-0.5 block italic text-courant-equipe">
                          {texte.remarque}
                        </span>
                      )}
                    </span>
                    <span className="texte-courant-equipe shrink-0 tabular-nums text-courant-equipe">
                      {formaterPrix(ligne.quantite * ligne.prixUnitaire, devise, langue)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex items-baseline justify-between border-t border-ligne pt-3">
              <span className="texte-libelles-equipe text-libelles-equipe">{t("total")}</span>
              <span className="texte-numeros tabular-nums text-numeros">
                {formaterPrix(demande.montantTotal, devise, langue)}
              </span>
            </p>
            {textes.details && (
              <p className="texte-courant-equipe mt-3 leading-relaxed text-courant-equipe">
                <span className="font-semibold">{t("note")}</span> {textes.details}
              </p>
            )}
          </>
        ) : demande.type === "QUESTION" ? (
          <blockquote className="texte-courant-equipe rounded-2xl border-s-[3px] border-bouton/50 bg-creux/60 px-4 py-3 leading-snug text-courant-equipe">
            « {textes.resume} »
          </blockquote>
        ) : (
          <>
            <p className="texte-textes-equipe leading-snug text-textes-equipe">{textes.resume}</p>
            {textes.details && (
              <p className="texte-courant-equipe mt-2 leading-relaxed text-courant-equipe">{textes.details}</p>
            )}
          </>
        )}
      </div>

      {issue ? (
        <>
          {demande.reponse && (
            <div className="mt-4 rounded-2xl bg-succes/[0.07] px-4 py-3">
              <p className="texte-libelles-equipe text-succes">{t("reponseEnvoyee")}</p>
              <p className="texte-courant-equipe mt-1 whitespace-pre-wrap leading-snug text-courant-equipe">
                {demande.reponse.original}
              </p>
              {demande.reponse.retenue && (
                <p className="texte-courant-equipe mt-2.5 flex items-start gap-1.5 border-t border-succes/15 pt-2.5 text-succes">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {t("reponseRetenue")}
                </p>
              )}
            </div>
          )}
          {"termineeA" in issue ? (
            <p className="texte-textes-equipe mt-6 flex items-center justify-center gap-2 rounded-2xl bg-succes/10 py-3.5 text-succes">
              <Check className="size-4" strokeWidth={3} aria-hidden />
              {t("termineeA", { heure: issue.termineeA })}
            </p>
          ) : (
            <p className="texte-textes-equipe mt-6 rounded-2xl bg-creux py-3.5 text-center text-textes-equipe">
              {t("expiree")}
            </p>
          )}
        </>
      ) : (
        <div className="mt-6">
          <ActionsDemande
            demandeId={demande.id}
            type={demande.type}
            libelles={libellesActionsEquipe(t, nomLangueClient)}
            actionDecision={deciderCommandeDepuisEspace}
            actionReponse={repondreQuestionDepuisEspace}
            taille="grand"
          />
        </div>
      )}
    </>
  );
}
