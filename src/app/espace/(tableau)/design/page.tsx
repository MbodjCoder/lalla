// « Design » (direction, dans Paramètres) : textes et couleurs de l'hôtel, pour les clients et l'équipe.
import { redirect } from "next/navigation";
import { DesignHotel } from "@/composants/espace/informations/DesignHotel";
import { EnTetePage } from "@/composants/espace/EnTetePage";
import { lireHotel } from "@/lib/hotel-courant";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { exigerPersonnel } from "@/lib/session-personnel";
import { lireCouleursEquipe } from "@/lib/couleurs";
import { lireTypographie } from "@/lib/typographie";

export const dynamic = "force-dynamic";

export default async function PageDesign() {
  const { hotelId, role } = await exigerPersonnel();
  if (role !== "DIRECTION") redirect("/espace/accueil?page=parametres");
  const hotel = await lireHotel(hotelId);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);

  return (
    <>
      <EnTetePage retour="/espace/accueil?page=parametres" libelleRetour={t("parametres")} titre={t("design")} />
      <DesignHotel
        langue={langue}
        nomAssistant={hotel.nomAssistant}
        nomHotel={hotel.nom}
        couleurs={{
          couleurAccent: hotel.couleurAccent,
          couleurMessages: hotel.couleurMessages,
          couleurFond: hotel.couleurFond,
          couleurHoraires: hotel.couleurHoraires,
          couleurIcones: hotel.couleurIcones,
          couleurMessagesClient: hotel.couleurMessagesClient,
          couleurBoutons: hotel.couleurBoutons,
        }}
        typographie={lireTypographie(hotel.typographie)}
        couleursEquipe={lireCouleursEquipe(hotel.couleursEquipe)}
      />
    </>
  );
}
