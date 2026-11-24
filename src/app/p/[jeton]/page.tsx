// Page ouverte depuis la notification WhatsApp : le personnel prend en charge
// puis termine la demande (ou répond à la question) en un geste, sans compte ni
// application — en français ou en anglais, quelle que soit la langue du client.
import { Check, Clock, Languages } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionsDemande } from "@/composants/espace/ActionsDemande";
import { libellesActionsEquipe } from "@/composants/espace/libelles-actions";
import { SelecteurLangueEquipe } from "@/composants/espace/SelecteurLangueEquipe";
import { bdd } from "@/lib/bdd";
import { variablesEspace } from "@/lib/couleurs";
import { versVue } from "@/lib/demandes";
import { formaterPrix } from "@/lib/format";
import { cleDepartement, cleType } from "@/lib/i18n/equipe";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { choisirTraduction, estLangueClient, FICHES_LANGUES, nomDeLangue } from "@/lib/langues";
import { deciderParLien, repondreParLien } from "./actions";

export const dynamic = "force-dynamic";

export default async function PageActionPersonnel({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const demande = await bdd.demande.findUnique({
    where: { jetonPersonnel: jeton },
    include: { lignes: true, chambre: true, hotel: true, sejour: true },
  });
  if (!demande || demande.statut === "PROPOSEE") notFound();

  const { langue, t } = await traducteurEquipeCourant(demande.hotel.langueEquipe);
  const vue = versVue(demande);
  const textes = choisirTraduction(vue.textes, langue, vue.textes.fr);
  const heure = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat(FICHES_LANGUES[langue].locale, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: demande.hotel.fuseauHoraire,
        }).format(date)
      : "";
  const codeClient = estLangueClient(demande.langueClient) ? demande.langueClient : null;
  const nomLangueClient = codeClient && codeClient !== langue ? nomDeLangue(codeClient, langue) : null;

  return (
    <main
      lang={langue}
      dir={FICHES_LANGUES[langue].sens}
      className="mx-auto min-h-dvh max-w-md px-5 py-8"
      style={variablesEspace(demande.hotel.couleurAccent, demande.hotel.couleurBoutons)}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-encre-pale">{demande.hotel.nom}</p>
        <SelecteurLangueEquipe langue={langue} libelle={t("choisirLangue")} />
      </div>
      <h1 className="mt-4 font-serif text-[46px] leading-none text-encre">
        {t("chambre")} {demande.chambre.numero}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-encre-douce">
        {t(cleType(vue.type))} · {t(cleDepartement(vue.departement))}
        {demande.sejour?.nomClient && <> · {demande.sejour.nomClient}</>}
        {vue.urgent && (
          <span className="rounded-full bg-alerte/10 px-2 py-0.5 text-[11px] font-bold uppercase text-alerte">
            {t("urgent")}
          </span>
        )}
      </p>

      <section className="mt-6 rounded-[24px] border border-ligne bg-surface p-5 shadow-carte">
        {vue.type === "COMMANDE" ? (
          <>
            <ul className="divide-y divide-ligne">
              {vue.lignes.map((ligne, rang) => {
                const texteLigne = choisirTraduction(ligne.textes, langue, ligne.textes.fr);
                return (
                  <li key={rang} className="flex gap-3 py-3 first:pt-0">
                    <span className="w-8 text-[18px] font-bold text-accent-profond">{ligne.quantite}×</span>
                    <span className="flex-1">
                      <span className="block text-[17px] font-semibold text-encre">{texteLigne.libelle}</span>
                      {texteLigne.remarque && (
                        <span className="block text-[14px] italic text-encre-douce">{texteLigne.remarque}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 flex justify-between border-t border-ligne pt-3 text-[15px]">
              <span className="text-encre-pale">{t("total")}</span>
              <span className="font-bold">{formaterPrix(vue.montantTotal, demande.hotel.devise, langue)}</span>
            </p>
          </>
        ) : (
          <p className="text-[18px] font-semibold leading-snug text-encre">{textes.resume}</p>
        )}
        {textes.details && (
          <p className="mt-3 rounded-xl bg-creux px-3 py-2 text-[14px] text-encre-douce">
            {t("note")} {textes.details}
          </p>
        )}
        {nomLangueClient && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-creux px-3 py-1 text-[12.5px] font-semibold text-encre-douce">
            <Languages className="size-3.5" />
            {t("languesClient", { langue: nomLangueClient })}
          </p>
        )}
      </section>

      <ol className="mt-6 space-y-2 text-[14px] text-encre-douce">
        <li className="flex items-center gap-2">
          <Clock className="size-4" /> {t("confirmeeA", { heure: heure(demande.confirmeeLe) })}
        </li>
        {demande.priseEnChargeLe && (
          <li className="flex items-center gap-2">
            <Check className="size-4 text-succes" /> {t("priseEnChargeA", { heure: heure(demande.priseEnChargeLe) })}
          </li>
        )}
        {demande.termineeLe && (
          <li className="flex items-center gap-2">
            <Check className="size-4 text-succes" /> {t("termineeA", { heure: heure(demande.termineeLe) })}
          </li>
        )}
      </ol>

      {/* Messages déjà envoyés au client à propos de cette demande */}
      {vue.messagesEquipe.length > 0 && (
        <ul className="mt-6 space-y-2">
          {vue.messagesEquipe.map((message) => (
            <li
              key={message.messageId}
              className="rounded-2xl bg-creux px-4 py-3 text-[14.5px] leading-snug text-encre"
            >
              <span className="block text-[12px] font-semibold text-encre-pale">{t("messageEnvoye")}</span>
              {message.original}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        {demande.statut === "CONFIRMEE" || demande.statut === "PRISE_EN_CHARGE" ? (
          <ActionsDemande
            demandeId={demande.id}
            type={vue.type}
            libelles={libellesActionsEquipe(t, nomLangueClient)}
            actionDecision={deciderParLien.bind(null, jeton)}
            actionReponse={repondreParLien.bind(null, jeton)}
            taille="grand"
          />
        ) : demande.statut === "TERMINEE" ? (
          <p className="rounded-2xl bg-succes/10 px-5 py-4 text-center text-[16px] font-semibold text-succes">
            {vue.type === "QUESTION" ? t("reponseEnvoyee") : t("demandeAcceptee")}
          </p>
        ) : (
          <p className="rounded-2xl bg-creux px-5 py-4 text-center text-[16px] text-encre-douce">
            {vue.declinee ? t("demandeDeclinee") : t("demandeAnnuleeClient")}
          </p>
        )}
      </div>
      <p className="mt-6 text-center text-[13px] text-encre-pale">{t("clientVoitAvancement")}</p>
    </main>
  );
}
