import { redirect } from "next/navigation";

// Ancienne page Notifications (liens WhatsApp, anciennes adresses) : commandes, questions et avis
// s'ouvrent désormais en page temporaire sur l'accueil
export default async function PageNotifications({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; h?: string }>;
}) {
  const { vue, h } = await searchParams;
  const parametres = new URLSearchParams({ page: vue ?? "commandes", ...(h ? { h } : {}) });
  redirect(`/espace/accueil?${parametres}`);
}
