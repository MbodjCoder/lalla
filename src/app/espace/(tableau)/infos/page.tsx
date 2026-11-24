import { redirect } from "next/navigation";

// Ancienne adresse : « Hôtel » est devenu l'accueil
export default function PageInfos() {
  redirect("/espace/accueil");
}
