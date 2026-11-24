// Chevalets de l'hôtel à imprimer : le gérant choisit les chambres, une page A6 par chambre.
import { ChevaletQr, StylesImpressionChevalets } from "@/composants/espace/ChevaletQr";
import { SelectionImpression } from "@/composants/espace/SelectionImpression";
import { bdd } from "@/lib/bdd";
import { env } from "@/lib/env";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { exigerPersonnel } from "@/lib/session-personnel";

export const metadata = { title: "QR codes · Lalla" };

export default async function PageTousQr() {
  const { hotelId } = await exigerPersonnel();
  const hotel = await bdd.hotel.findUniqueOrThrow({
    where: { id: hotelId },
    include: {
      chambres: { where: { actif: true }, orderBy: { numero: "asc" } },
    },
  });
  const { t } = await traducteurEquipeCourant(hotel.langueEquipe);

  return (
    <div className="flex flex-col items-center gap-6 print:block">
      <StylesImpressionChevalets />
      <SelectionImpression
        libelles={{
          titre: t("choisirChambres"),
          toutes: t("toutes"),
          aucune: t("aucune"),
          imprimer: t("imprimer"),
        }}
        chevalets={hotel.chambres.map((chambre) => ({
          id: chambre.id,
          numero: chambre.numero,
          contenu: (
            <ChevaletQr
              url={`${env.URL_PUBLIQUE}/c/${chambre.jetonQr}`}
              numeroChambre={chambre.numero}
              nomAssistant={hotel.nomAssistant}
              accroche={t("accrocheChevalet")}
              sautDePage
            />
          ),
        }))}
      />
    </div>
  );
}
