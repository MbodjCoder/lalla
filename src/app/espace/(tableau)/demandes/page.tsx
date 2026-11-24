import { redirect } from "next/navigation";

// Ancienne adresse : les demandes sont dans « Notifications »
export default function PageDemandes() {
  redirect("/espace/accueil");
}
