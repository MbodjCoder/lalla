import { variablesPage, type PageEquipe } from "@/lib/couleurs";

/** Une page de l'équipe : ses cartes, ses onglets et ses textes prennent les couleurs choisies pour elle. */
export function ZonePage({ page, children }: { page: PageEquipe; children: React.ReactNode }) {
  return <div style={variablesPage(page)}>{children}</div>;
}
