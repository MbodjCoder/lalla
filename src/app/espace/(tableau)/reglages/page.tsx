import { redirect } from "next/navigation";

// Ancienne adresse : les réglages sont dans « Paramètres »
export default function PageReglages() {
  redirect("/espace/accueil?page=parametres");
}
