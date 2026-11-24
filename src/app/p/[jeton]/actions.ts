"use server";

// Le jeton du lien WhatsApp vaut autorisation pour CETTE demande uniquement.
import { revalidatePath } from "next/cache";
import { bdd } from "@/lib/bdd";
import { deciderCommande, repondreQuestion } from "@/lib/demandes";
import { lireLangueEquipe } from "@/lib/langue-equipe";

const demandeDuLien = (jeton: string) =>
  bdd.demande.findUnique({
    where: { jetonPersonnel: jeton },
    select: { id: true, hotelId: true, hotel: { select: { langueEquipe: true } } },
  });

/** Commande ou demande : l'accepter, ou l'annuler (mêmes règles que l'espace hôtel). */
export async function deciderParLien(jeton: string, formulaire: FormData) {
  const demande = await demandeDuLien(jeton);
  if (!demande) return;
  const decision = formulaire.get("decision") === "annuler" ? "annuler" : "accepter";
  await deciderCommande(demande.id, demande.hotelId, decision);
  revalidatePath(`/p/${jeton}`);
}

/** Question : la réponse de l'équipe, que Lalla traduit et transmet au client. */
export async function repondreParLien(jeton: string, formulaire: FormData) {
  const demande = await demandeDuLien(jeton);
  if (!demande) return;
  const langue = await lireLangueEquipe(demande.hotel.langueEquipe);
  await repondreQuestion(demande.id, demande.hotelId, String(formulaire.get("message") ?? ""), langue);
  revalidatePath(`/p/${jeton}`);
}
