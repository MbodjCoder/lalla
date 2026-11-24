import { redirect } from "next/navigation";

// Ancienne adresse : les réglages de l'hôtel sont désormais dans « Informations de l'hôtel »
export default function PageReglagesHotel() {
  redirect("/espace/informations");
}
