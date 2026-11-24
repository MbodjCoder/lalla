// Chevalet d'une chambre, prêt à imprimer.
import { notFound } from "next/navigation";
import { BoutonImprimer } from "@/composants/espace/BoutonImprimer";
import { ChevaletQr, StylesImpressionChevalets } from "@/composants/espace/ChevaletQr";
import { bdd } from "@/lib/bdd";
import { env } from "@/lib/env";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { exigerPersonnel } from "@/lib/session-personnel";

export const metadata = { title: "QR code · Lalla" };

export default async function PageQr({ params }: { params: Promise<{ id: string }> }) {
  const { hotelId } = await exigerPersonnel();
  const { id } = await params;
  const chambre = await bdd.chambre.findFirst({
    where: { id, hotelId },
    include: { hotel: true },
  });
  if (!chambre) notFound();
  const { t } = await traducteurEquipeCourant(chambre.hotel.langueEquipe);
  const url = `${env.URL_PUBLIQUE}/c/${chambre.jetonQr}`;

  return (
    <div className="flex flex-col items-center gap-6 print:block">
      <StylesImpressionChevalets />
      <BoutonImprimer libelle={t("imprimerChevalet")} />
      <ChevaletQr
        url={url}
        numeroChambre={chambre.numero}
        nomAssistant={chambre.hotel.nomAssistant}
        accroche={t("accrocheChevalet")}
      />
      <p className="texte-details-equipe print:hidden text-details-equipe">{url}</p>
    </div>
  );
}
