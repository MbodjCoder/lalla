// Informations (direction, dans Paramètres) : identité, contacts, Wi-Fi et séjour, délais,
// liens, et les fiches dont l'assistant tire ses réponses.
import { redirect } from "next/navigation";
import { InformationsHotel } from "@/composants/espace/informations/InformationsHotel";
import { EnTetePage } from "@/composants/espace/EnTetePage";
import { bdd } from "@/lib/bdd";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { exigerPersonnel } from "@/lib/session-personnel";

export const dynamic = "force-dynamic";

export default async function PageInformations() {
  const { hotelId, role } = await exigerPersonnel();
  if (role !== "DIRECTION") redirect("/espace/accueil?page=parametres");
  const [hotel, fiches] = await Promise.all([
    bdd.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      include: { services: true },
    }),
    // Les fiches préparées par l'assistant, à relire, d'abord
    bdd.document.findMany({
      where: { hotelId },
      orderBy: [{ aVerifier: "desc" }, { titre: "asc" }],
      select: {
        id: true,
        titre: true,
        type: true,
        contenu: true,
        aVerifier: true,
      },
    }),
  ]);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);

  return (
    <>
      <EnTetePage
        retour="/espace/accueil?page=parametres"
        libelleRetour={t("parametres")}
        titre={t("informationsTitre")}
      />
      <InformationsHotel
        langue={langue}
        nomAssistant={hotel.nomAssistant}
        valeurs={{
          nom: hotel.nom,
          sousTitre: hotel.sousTitre ?? "",
          nomAssistant: hotel.nomAssistant,
          langueEquipe: hotel.langueEquipe,
          telephoneReception: hotel.telephoneReception ?? "",
          whatsappReception: hotel.whatsappReception ?? "",
          whatsappDirection: hotel.whatsappDirection ?? "",
          wifiReseau: hotel.wifiReseau ?? "",
          wifiMotDePasse: hotel.wifiMotDePasse ?? "",
          heureCheckout: hotel.heureCheckout,
          delaiRestauration: hotel.delaiRestauration?.toString() ?? "",
          delaiEtages: hotel.delaiEtages?.toString() ?? "",
          delaiTechnique: hotel.delaiTechnique?.toString() ?? "",
          lienAvisPublic: hotel.lienAvisPublic ?? "",
          lienReservation: hotel.lienReservation ?? "",
          codeFidelite: hotel.codeFidelite ?? "",
          ...Object.fromEntries(
            hotel.services.map((service) => [`whatsapp_${service.departement}`, service.whatsapp ?? ""]),
          ),
        }}
        fiches={fiches}
      />
    </>
  );
}
