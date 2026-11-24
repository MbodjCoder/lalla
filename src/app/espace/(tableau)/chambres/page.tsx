import { redirect } from "next/navigation";

// Ancienne adresse : « chambres » s"ouvre désormais en page temporaire sur l"accueil
export default async function Page({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const recus = await searchParams;
  const suivants = new URLSearchParams({ page: "chambres" });
  for (const cle of ["vue"] as const) {
    const valeur = recus[cle];
    if (valeur) suivants.set(cle, valeur);
  }
  redirect(`/espace/accueil?${suivants}`);
}
