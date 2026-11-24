import { redirect } from "next/navigation";

// Ancienne adresse : « À traiter » est devenu « Notifications »
export default function PageATraiter() {
  redirect("/espace/accueil");
}
