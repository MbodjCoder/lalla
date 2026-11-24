// Contenu de la page temporaire « parametres » de l'accueil (?page=parametres).
// « Paramètres » (rangés dans « Hôtel ») : la langue, puis, pour la direction, les informations
// de l'hôtel et son design ; en bas, le compte connecté avec sa déconnexion, dans un seul bloc.
// Chaque réglage est une carte à part, espacée des autres.
import { ChevronRight, Hotel, Languages, LogOut, Palette } from "lucide-react";
import Link from "next/link";
import { ZonePage } from "@/composants/espace/ZonePage";
import { SelecteurLangueEquipe } from "@/composants/espace/SelecteurLangueEquipe";
import { bdd } from "@/lib/bdd";
import { lireHotel } from "@/lib/hotel-courant";
import { traducteurEquipeCourant } from "@/lib/langue-equipe";
import { notificationsHotel } from "@/lib/notifications-hotel";
import { exigerPersonnel } from "@/lib/session-personnel";
import { seDeconnecter } from "@/app/espace/actions";

const CARTE = "rounded-[22px] border border-ligne bg-surface shadow-carte";
const PASTILLE_ICONE = "grid size-10 shrink-0 place-items-center rounded-full bg-bouton/10 text-bouton";

export async function ContenuParametres() {
  const session = await exigerPersonnel();
  const direction = session.role === "DIRECTION";
  const [hotel, personnel, notifications] = await Promise.all([
    lireHotel(session.hotelId),
    bdd.personnel.findUniqueOrThrow({ where: { id: session.personnelId }, select: { email: true } }),
    notificationsHotel(session),
  ]);
  const { langue, t } = await traducteurEquipeCourant(hotel.langueEquipe);
  const initiales = session.nom
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join("");

  // Réglages de la direction : chacun ouvre sa page
  const reglages = direction
    ? [
        {
          href: "/espace/informations",
          icone: Hotel,
          libelle: t("informationsTitre"),
          detail: t("detailInformations"),
          notifications: notifications.parametres,
        },
        { href: "/espace/design", icone: Palette, libelle: t("design"), detail: t("detailDesign"), notifications: 0 },
      ]
    : [];

  return (
    <ZonePage page="parametres">
      <div className="mx-auto max-w-2xl space-y-3">
        {/* Langue, mémorisée sur cet appareil */}
        <section className={`${CARTE} flex items-center gap-4 px-5 py-3.5`}>
          <span className={PASTILLE_ICONE} aria-hidden>
            <Languages className="size-5" strokeWidth={2.3} />
          </span>
          <span className="texte-textes-equipe min-w-0 flex-1 text-textes-equipe">{t("langueInterface")}</span>
          <SelecteurLangueEquipe langue={langue} libelle={t("choisirLangue")} />
        </section>

        {reglages.map(({ href, icone: Icone, libelle, detail, notifications: nombre }) => (
          <Link
            key={href}
            href={href}
            className={`${CARTE} flex items-center gap-4 px-5 py-3.5 transition hover:border-encre/20 active:scale-[0.99]`}
          >
            <span className={PASTILLE_ICONE} aria-hidden>
              <Icone className="size-5" strokeWidth={2.3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="texte-textes-equipe block text-textes-equipe">{libelle}</span>
              <span className="texte-details-equipe block truncate text-details-equipe">{detail}</span>
            </span>
            {nombre > 0 && (
              <span className="texte-etiquettes-equipe grid h-6 min-w-6 place-items-center rounded-full bg-alerte px-1.5 tabular-nums text-white">
                {nombre}
              </span>
            )}
            <ChevronRight className="size-5 shrink-0 text-encre-pale rtl:-scale-x-100" aria-hidden />
          </Link>
        ))}

        {/* Le compte connecté et sa déconnexion, ensemble, en bas */}
        <section className={`${CARTE} mt-6 flex items-center gap-4 py-3.5 ps-5 pe-3`}>
          <span className="texte-libelles-equipe grid size-12 shrink-0 place-items-center rounded-full bg-bouton/10 text-bouton">
            {initiales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="texte-textes-equipe truncate text-textes-equipe">{session.nom}</p>
            <p className="texte-details-equipe truncate text-details-equipe">{personnel.email}</p>
          </div>
          <form action={seDeconnecter}>
            <button
              aria-label={t("seDeconnecter")}
              title={t("seDeconnecter")}
              className="grid size-11 place-items-center rounded-full bg-alerte/10 text-alerte transition hover:bg-alerte/15 active:scale-90"
            >
              <LogOut className="size-5 rtl:-scale-x-100" strokeWidth={2.4} aria-hidden />
            </button>
          </form>
        </section>
      </div>
    </ZonePage>
  );
}
