// Contenu de la page temporaire « chambres » de l'accueil (?page=chambres).
// Chambres (dans « Hôtel ») : arrivée / départ (active ou coupe les commandes) et QR code
// de chaque chambre. Onglets Départs · Occupées · Libres ; « Départs » réunit les départs du jour
// et ceux qui sont dépassés (client parti sans enregistrement), et s'ouvre en premier s'il y en a.
import { ZonePage } from "@/composants/espace/ZonePage";
import { MenuQrChambre } from "@/composants/espace/MenuQrChambre";
import { OngletsSegmentes } from "@/composants/espace/OngletsSegmentes";
import { bdd } from "@/lib/bdd";
import { lireHotel } from "@/lib/hotel-courant";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { FICHES_LANGUES } from "@/lib/langues";
import { exigerPersonnel } from "@/lib/session-personnel";
import { enregistrerArrivee, enregistrerDepart } from "@/app/espace/actions";

type Vue = "departs" | "occupees" | "libres";

const JOUR_MS = 24 * 3600 * 1000;

export async function ContenuChambres({ parametres }: { parametres: { vue?: string } }) {
  const { hotelId, role } = await exigerPersonnel();
  const hotel = await lireHotel(hotelId);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);
  const chambres = await bdd.chambre.findMany({
    where: { hotelId },
    orderBy: { numero: "asc" },
    include: { sejours: { where: { statut: "EN_COURS" }, take: 1 } },
  });

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const demain = new Date(Date.now() + JOUR_MS).toISOString().slice(0, 10);
  const formaterDate = (date: Date) =>
    new Intl.DateTimeFormat(FICHES_LANGUES[langue].locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: hotel.fuseauHoraire,
    }).format(date);
  // Départs selon le calendrier de l'hôtel (dates « AAAA-MM-JJ », comparables comme du texte)
  const jourHotel = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: hotel.fuseauHoraire }).format(date);
  const jour = jourHotel(new Date());
  const joursDeRetard = (depart: Date) => Math.round((Date.parse(jour) - Date.parse(jourHotel(depart))) / JOUR_MS);
  const occupees = chambres.filter((chambre) => chambre.sejours.length > 0);
  const parVue: Record<Vue, typeof chambres> = {
    // Le plus en retard d'abord
    departs: occupees
      .filter((chambre) => jourHotel(chambre.sejours[0].depart) <= jour)
      .sort((a, b) => a.sejours[0].depart.getTime() - b.sejours[0].depart.getTime()),
    occupees,
    libres: chambres.filter((chambre) => chambre.sejours.length === 0),
  };
  const { vue: vueDemandee } = parametres;
  const vue: Vue =
    vueDemandee === "departs" || vueDemandee === "occupees" || vueDemandee === "libres"
      ? vueDemandee
      : parVue.departs.length > 0
        ? "departs"
        : "occupees";
  // Échéance du séjour, en rouge dès que le départ est dépassé
  const echeance = (depart: Date) => {
    const retard = joursDeRetard(depart);
    if (retard > 0) return { texte: t("departDepasse", { n: retard }), depasse: true };
    if (retard === 0) return { texte: t("departAujourdhui"), depasse: false };
    return {
      texte: t("departLe", { date: formaterDate(depart) }),
      depasse: false,
    };
  };

  return (
    <ZonePage page="chambres">
      <div className="mt-6">
        <OngletsSegmentes
          actif={vue}
          onglets={(
            [
              ["departs", t("ongletDeparts")],
              ["occupees", t("ongletOccupees")],
              ["libres", t("libres")],
            ] as const
          ).map(([cle, libelle]) => ({
            cle,
            libelle,
            href: `?page=chambres&vue=${cle}`,
            nombre: parVue[cle].length,
          }))}
        />
      </div>

      {parVue[vue].length === 0 ? (
        <p className="texte-details-equipe mt-5 rounded-[24px] border border-ligne bg-surface px-5 py-8 text-center text-details-equipe">
          {t("aucuneChambre")}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ligne rounded-[24px] border border-ligne bg-surface shadow-carte">
          {parVue[vue].map((chambre) => {
            const sejour = chambre.sejours[0];
            const etat = sejour ? echeance(sejour.depart) : null;
            return (
              <li
                key={chambre.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4.5 sm:gap-x-5 sm:px-6"
              >
                <span className="texte-numeros w-12 text-numeros sm:w-14">{chambre.numero}</span>

                {sejour ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="texte-textes-equipe truncate text-textes-equipe">
                        {sejour.nomClient ?? t("clientSansNom")}
                      </p>
                      <p
                        className={`texte-details-equipe ${etat?.depasse ? "font-semibold text-alerte" : "text-details-equipe"}`}
                      >
                        {etat?.texte}
                      </p>
                    </div>
                    <form action={enregistrerDepart}>
                      <input type="hidden" name="chambreId" value={chambre.id} />
                      {/* Départ du jour ou dépassé : le bouton principal ; sinon discret */}
                      <button
                        className={`texte-boutons-equipe h-10 rounded-xl px-3.5 transition sm:px-4 ${
                          vue === "departs"
                            ? "bg-bouton text-texte-bouton active:scale-[0.98]"
                            : "border border-ligne hover:bg-creux"
                        }`}
                      >
                        {t("depart")}
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={enregistrerArrivee} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="chambreId" value={chambre.id} />
                    <input
                      name="nomClient"
                      placeholder={t("nomClientFacultatif")}
                      className="texte-champs-equipe h-10 min-w-0 flex-1 rounded-xl border border-ligne bg-fond px-3 outline-none focus:border-encre"
                    />
                    <input
                      name="depart"
                      type="date"
                      required
                      defaultValue={demain}
                      min={aujourdhui}
                      aria-label={t("dateDepart")}
                      className="texte-champs-equipe h-10 rounded-xl border border-ligne bg-fond px-3 outline-none focus:border-encre"
                    />
                    <button className="texte-boutons-equipe h-10 rounded-xl bg-bouton px-4 text-texte-bouton transition active:scale-[0.98]">
                      {t("arrivee")}
                    </button>
                  </form>
                )}

                {vue !== "departs" && (
                  <MenuQrChambre
                    chambreId={chambre.id}
                    peutRegenerer={role === "DIRECTION"}
                    libelles={{
                      qrCode: t("qrCode", { n: chambre.numero }),
                      imprimer: t("imprimerQr"),
                      regenerer: t("regenererQr"),
                      confirmer: t("confirmerRegenererQr"),
                      boutonConfirmer: t("regenerer"),
                      explication: t("explicationRegenererQr"),
                      annuler: t("annuler"),
                      regenere: t("qrRegenere"),
                      imprimerNouveau: t("imprimerNouveauQr"),
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ZonePage>
  );
}
