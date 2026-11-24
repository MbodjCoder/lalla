// Enregistrement d'un message vocal dans le navigateur, converti en WAV 16 kHz mono :
// le format que la transcription accepte partout, quel que soit le codec du téléphone
// (webm/opus sur Android, mp4/aac sur iPhone).

const FREQUENCE_CIBLE = 16_000;
const DUREE_MIN_S = 0.4; // en deçà, un appui involontaire

export type Enregistrement = {
  /** Fin de l'enregistrement : l'audio en WAV base64, ou null s'il est trop court. */
  arreter: () => Promise<string | null>;
  annuler: () => void;
};

export function enregistrementPossible(): boolean {
  return typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && "MediaRecorder" in window;
}

/** Ouvre le micro (le navigateur demande l'autorisation la première fois). */
export async function demarrerEnregistrement(): Promise<Enregistrement> {
  const flux = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const enregistreur = new MediaRecorder(flux);
  const morceaux: Blob[] = [];
  enregistreur.ondataavailable = (evenement) => {
    if (evenement.data.size > 0) morceaux.push(evenement.data);
  };
  // Le témoin d'enregistrement du téléphone s'éteint dès la fin
  const fermerMicro = () => flux.getTracks().forEach((piste) => piste.stop());
  enregistreur.start();

  return {
    arreter: () =>
      new Promise((resoudre, rejeter) => {
        enregistreur.onstop = async () => {
          fermerMicro();
          try {
            resoudre(await versWavBase64(new Blob(morceaux, { type: enregistreur.mimeType })));
          } catch (erreur) {
            rejeter(erreur);
          }
        };
        if (enregistreur.state === "inactive") enregistreur.onstop(new Event("stop"));
        else enregistreur.stop();
      }),
    annuler: () => {
      enregistreur.onstop = null;
      if (enregistreur.state !== "inactive") enregistreur.stop();
      fermerMicro();
    },
  };
}

async function versWavBase64(audio: Blob): Promise<string | null> {
  const Contexte =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const donnees = await audio.arrayBuffer();
  const contexte = new Contexte();
  try {
    const decode = await new Promise<AudioBuffer>((resoudre, rejeter) =>
      // Forme à rappels : la seule que gèrent les anciens Safari
      contexte.decodeAudioData(donnees, resoudre, rejeter),
    );
    if (decode.duration < DUREE_MIN_S) return null;
    return base64(encoderWav(reechantillonner(decode)));
  } finally {
    void contexte.close();
  }
}

/** Mono, 16 kHz : moyenne des canaux puis moyenne de chaque tranche d'échantillons. */
function reechantillonner(audio: AudioBuffer): Float32Array {
  const canaux = Array.from({ length: audio.numberOfChannels }, (_, rang) => audio.getChannelData(rang));
  const rapport = audio.sampleRate / FREQUENCE_CIBLE;
  const sortie = new Float32Array(Math.floor(audio.length / rapport));
  for (let i = 0; i < sortie.length; i++) {
    const debut = Math.floor(i * rapport);
    const fin = Math.max(debut + 1, Math.floor((i + 1) * rapport));
    let somme = 0;
    for (const canal of canaux) for (let j = debut; j < fin; j++) somme += canal[j] ?? 0;
    sortie[i] = somme / ((fin - debut) * canaux.length);
  }
  return sortie;
}

function encoderWav(echantillons: Float32Array): Uint8Array {
  const tampon = new ArrayBuffer(44 + echantillons.length * 2);
  const vue = new DataView(tampon);
  const ecrire = (position: number, texte: string) =>
    [...texte].forEach((lettre, rang) => vue.setUint8(position + rang, lettre.charCodeAt(0)));
  ecrire(0, "RIFF");
  vue.setUint32(4, 36 + echantillons.length * 2, true);
  ecrire(8, "WAVE");
  ecrire(12, "fmt ");
  vue.setUint32(16, 16, true); // taille du bloc fmt
  vue.setUint16(20, 1, true); // PCM
  vue.setUint16(22, 1, true); // mono
  vue.setUint32(24, FREQUENCE_CIBLE, true);
  vue.setUint32(28, FREQUENCE_CIBLE * 2, true); // octets par seconde
  vue.setUint16(32, 2, true); // octets par échantillon
  vue.setUint16(34, 16, true); // bits par échantillon
  ecrire(36, "data");
  vue.setUint32(40, echantillons.length * 2, true);
  echantillons.forEach((valeur, rang) => {
    const borne = Math.max(-1, Math.min(1, valeur));
    vue.setInt16(44 + rang * 2, borne < 0 ? borne * 0x8000 : borne * 0x7fff, true);
  });
  return new Uint8Array(tampon);
}

function base64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}
