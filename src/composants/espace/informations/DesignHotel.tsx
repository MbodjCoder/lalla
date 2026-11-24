"use client";

// « Design » : un seul formulaire, rangé par endroit (EditeurDesign) ; une modification en cours
// n'est pas perdue en changeant d'endroit, et tout s'enregistre d'un seul geste.
import { Palette } from "lucide-react";
import { enregistrerInformations } from "@/app/espace/actions";
import type { CouleursEquipe } from "@/lib/couleurs";
import { traducteurEquipe, type TraduireEquipe } from "@/lib/i18n/equipe";
import type { LangueEquipe } from "@/lib/langues";
import type { Typographie } from "@/lib/typographie";
import { EditeurDesign } from "./EditeurDesign";
import type { CouleursHotel } from "./SectionApparence";
import { SectionFormulaire } from "./SectionFormulaire";

export function DesignHotel({
  langue,
  nomAssistant,
  nomHotel,
  couleurs,
  typographie,
  couleursEquipe,
}: {
  langue: LangueEquipe;
  nomAssistant: string;
  nomHotel: string;
  couleurs: CouleursHotel;
  typographie: Typographie;
  couleursEquipe: CouleursEquipe;
}) {
  const t: TraduireEquipe = traducteurEquipe(langue);
  return (
    <div className="mt-6">
      <SectionFormulaire
        id="design"
        icone={Palette}
        titre={t("design")}
        action={enregistrerInformations}
        cachees={{ section: "design" }}
        requete=""
        sansEntete
        masquee={false}
        t={t}
      >
        <EditeurDesign
          typographie={typographie}
          couleurs={couleurs}
          couleursEquipe={couleursEquipe}
          nomAssistant={nomAssistant}
          nomHotel={nomHotel}
          t={t}
        />
      </SectionFormulaire>
    </div>
  );
}
