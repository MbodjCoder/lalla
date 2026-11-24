import { redirect } from "next/navigation";

// Ancienne adresse (liens des notifications WhatsApp) : les avis s'ouvrent en page temporaire sur l'accueil
export default function PageAvis() {
  redirect("/espace/accueil?page=avis");
}
