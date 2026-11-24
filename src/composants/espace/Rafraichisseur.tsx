"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Rafraîchit les données serveur de la page à intervalle régulier
// (en pause quand l'onglet est masqué).
export function Rafraichisseur({ intervalleMs }: { intervalleMs: number }) {
  const routeur = useRouter();
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (!document.hidden) routeur.refresh();
    }, intervalleMs);
    return () => clearInterval(minuterie);
  }, [routeur, intervalleMs]);
  return null;
}
