"use client";

import { useEffect, useRef } from "react";

// Signal discret quand une nouvelle demande arrive : compteur dans l'onglet
// du navigateur et carillon doux (deux notes), utile à un comptoir de réception.
export function AlerteNouvelles({ nombre, titre }: { nombre: number; titre: string }) {
  const precedent = useRef(nombre);

  useEffect(() => {
    document.title = nombre > 0 ? `(${nombre}) ${titre}` : titre;
    if (nombre > precedent.current) jouerCarillon();
    precedent.current = nombre;
  }, [nombre, titre]);

  return null;
}

function jouerCarillon() {
  try {
    const contexte = new AudioContext();
    [880, 1318.5].forEach((frequence, rang) => {
      const oscillateur = contexte.createOscillator();
      const volume = contexte.createGain();
      const debut = contexte.currentTime + rang * 0.18;
      oscillateur.frequency.value = frequence;
      oscillateur.type = "sine";
      volume.gain.setValueAtTime(0.0001, debut);
      volume.gain.exponentialRampToValueAtTime(0.18, debut + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.6);
      oscillateur.connect(volume).connect(contexte.destination);
      oscillateur.start(debut);
      oscillateur.stop(debut + 0.65);
    });
  } catch {
    // Son bloqué par le navigateur tant que la page n'a pas été touchée : le compteur suffit
  }
}
