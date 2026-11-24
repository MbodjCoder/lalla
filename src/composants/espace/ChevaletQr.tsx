// Chevalet de chambre imprimable (A6 portrait, pleine page) : le support physique du produit.
// Bleu nuit et or, filets art déco : Lalla disponible 24h/24, un grand QR code doré encadré,
// le numéro de la chambre.
import QRCode from "qrcode";

type Proprietes = {
  url: string;
  numeroChambre: string;
  nomAssistant: string;
  accroche: string; // « Your concierge, available 24/7 »
  sautDePage?: boolean; // impression en série : une page par chevalet
};

const NUIT = "#132241";
const OR = "#d4b577";
const OR_CLAIR = "#efdcaa";
const TAILLE_REPERE = 7; // carrés de repérage aux trois coins, en modules
const ARRONDI_MODULE = 0.3;
const MARGE_QR = 2; // zone calme autour du code, en modules

/**
 * QR code doré sur fond nuit (modules clairs sur fond sombre, lu par les appareils photo des
 * téléphones récents) : repères en carrés à coins ronds, modules adoucis, léger dégradé d'or.
 */
function qrDore(url: string): string {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "Q" });
  const taille = modules.size;
  const cote = taille + 2 * MARGE_QR;
  const dansRepere = (ligne: number, colonne: number) =>
    (ligne < TAILLE_REPERE && (colonne < TAILLE_REPERE || colonne >= taille - TAILLE_REPERE)) ||
    (ligne >= taille - TAILLE_REPERE && colonne < TAILLE_REPERE);

  const points: string[] = [];
  for (let ligne = 0; ligne < taille; ligne++) {
    for (let colonne = 0; colonne < taille; colonne++) {
      if (!modules.get(ligne, colonne) || dansRepere(ligne, colonne)) continue;
      points.push(
        `<rect x="${colonne + MARGE_QR}" y="${ligne + MARGE_QR}" width="1" height="1" rx="${ARRONDI_MODULE}"/>`,
      );
    }
  }

  // Anneau 7×7 évidé (5×5) puis cœur 3×3, chacun à coins ronds
  const repere = (x: number, y: number) =>
    `<path fill-rule="evenodd" d="${carreArrondi(x, y, 7, 2)} ${carreArrondi(x + 1, y + 1, 5, 1.3)}"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9"/>`;
  const m = MARGE_QR;
  const fin = taille - TAILLE_REPERE + m;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cote} ${cote}" shape-rendering="geometricPrecision" role="img" aria-label="QR code">` +
    `<defs><linearGradient id="or-qr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${OR}"/><stop offset="0.5" stop-color="${OR_CLAIR}"/><stop offset="1" stop-color="${OR}"/></linearGradient></defs>` +
    `<rect width="${cote}" height="${cote}" fill="${NUIT}"/>` +
    `<g fill="url(#or-qr)">${repere(m, m)}${repere(fin, m)}${repere(m, fin)}${points.join("")}</g></svg>`
  );
}

function carreArrondi(x: number, y: number, cote: number, rayon: number): string {
  const fin = cote - 2 * rayon;
  return `M${x + rayon} ${y}h${fin}a${rayon} ${rayon} 0 0 1 ${rayon} ${rayon}v${fin}a${rayon} ${rayon} 0 0 1 -${rayon} ${rayon}h-${fin}a${rayon} ${rayon} 0 0 1 -${rayon} -${rayon}v-${fin}a${rayon} ${rayon} 0 0 1 ${rayon} -${rayon}z`;
}

export function ChevaletQr({ url, numeroChambre, nomAssistant, accroche, sautDePage = false }: Proprietes) {
  // SVG construit ici à partir d'une URL maîtrisée : insertion sûre
  const svg = qrDore(url);

  return (
    <article
      className={`@container relative aspect-[105/148] w-full max-w-[400px] overflow-hidden rounded-[22px] shadow-carte print:h-[148mm] print:w-[105mm] print:max-w-none print:rounded-none print:shadow-none ${
        sautDePage ? "print:break-after-page" : ""
      }`}
      style={{ background: `radial-gradient(120% 90% at 50% 35%, #1b2d52 0%, ${NUIT} 55%, #0d1830 100%)` }}
    >
      <FiletsArtDeco />

      {/* Tailles en cqw (largeur du chevalet) : la même mise en page à l'écran et sur papier */}
      <div className="relative flex h-full flex-col items-center px-[9cqw] pt-[9cqw] pb-[11cqw] text-center">
        {/* Lalla, disponible à toute heure */}
        <div className="flex items-center gap-[3.5cqw] self-stretch">
          <PortraitDore className="size-[17cqw] shrink-0" />
          <p className="min-w-0 text-start leading-tight whitespace-nowrap" style={{ color: OR }}>
            <span className="font-serif text-[7cqw] italic" style={{ color: OR_CLAIR }}>
              {nomAssistant},
            </span>{" "}
            <span className="text-[3.25cqw]">{accroche}</span>
          </p>
        </div>

        {/* Invitation à scanner, puis le code dans son cadre doré */}
        <div className="min-h-[5cqw] flex-1" />
        <p className="font-serif text-[5.6cqw] leading-none tracking-[0.34em] uppercase" style={{ color: OR }}>
          Scan me
        </p>
        <div className="relative mt-[4.5cqw] w-[78cqw] border-[0.3cqw] p-[3cqw]" style={{ borderColor: OR }}>
          <CoinsCadre />
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <p className="mt-[4.5cqw] text-[4.4cqw] leading-none tracking-[0.3em] tabular-nums" style={{ color: OR }}>
          {numeroChambre}
        </p>
      </div>
    </article>
  );
}

/**
 * Portrait de Lalla en or sur bleu nuit, dans un médaillon : le même dessin que son avatar
 * (foulard noué, créoles, tailleur à col), décliné en deux tons.
 */
function PortraitDore({ className }: { className: string }) {
  const trait = { stroke: OR, strokeWidth: 0.85, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id="or-portrait" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={OR_CLAIR} />
          <stop offset="1" stopColor={OR} />
        </linearGradient>
        <clipPath id="medaillon">
          <circle cx="60" cy="60" r="55" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="58" fill={NUIT} stroke={OR} strokeWidth="1.8" />
      <g clipPath="url(#medaillon)">
        <g transform="translate(60 67) scale(1.18) translate(-60 -58)">
          {/* Buste : tailleur, revers et col */}
          <path d="M2 124 C6 97 29 83.5 60 83.5 C91 83.5 114 97 118 124 Z" fill={NUIT} {...trait} />
          <path d="M49.5 84 L60 99.5 L70.5 84 Z" fill="url(#or-portrait)" />
          <path d="M44 85 L60 104.5 L52 84.1 Z" fill={NUIT} {...trait} />
          <path d="M76 85 L60 104.5 L68 84.1 Z" fill={NUIT} {...trait} />
          <circle cx="81" cy="96" r="1.9" fill={OR_CLAIR} />

          {/* Cou, oreilles, créoles */}
          <path d="M52.5 72 L52.5 83.5 Q60 88.5 67.5 83.5 L67.5 72 Z" fill="url(#or-portrait)" />
          <ellipse cx="43.6" cy="57.5" rx="2.8" ry="4.5" fill={OR} />
          <ellipse cx="76.4" cy="57.5" rx="2.8" ry="4.5" fill={OR} />
          <circle cx="43.4" cy="65.2" r="3" fill="none" stroke={OR_CLAIR} strokeWidth="1.3" />
          <circle cx="76.6" cy="65.2" r="3" fill="none" stroke={OR_CLAIR} strokeWidth="1.3" />

          {/* Visage */}
          <path
            d="M44 54.5 C44 42 51.2 36 60 36 C68.8 36 76 42 76 54.5 C76 67 69.3 76.5 60 76.5 C50.7 76.5 44 67 44 54.5 Z"
            fill="url(#or-portrait)"
          />
          <g stroke={NUIT} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Sourcils, yeux en amande et cils, nez, sourire */}
            <path d="M50.4 50 Q53.9 47.4 57.4 49 M62.6 49 Q66.1 47.4 69.6 50" strokeWidth="1.2" />
            <path
              d="M57.8 55 Q54.1 51.6 50.4 54.9 L49.4 54.1 M62.2 55 Q65.9 51.6 69.6 54.9 L70.6 54.1"
              strokeWidth="1.1"
            />
            <path d="M57.9 62.4 Q60 64.4 62.1 62.4" strokeWidth="1" />
            <path d="M54.5 67.6 Q60 72.6 65.5 67.6" strokeWidth="1.3" />
          </g>
          <circle cx="54.2" cy="54.8" r="1.6" fill={NUIT} />
          <circle cx="65.8" cy="54.8" r="1.6" fill={NUIT} />

          {/* Foulard enveloppant, plis, nœud en haut à droite */}
          <path
            d="M41.3 52.5 C36.5 31 46 15.5 62 14.5 C78.5 13.5 89.5 26.5 84.5 42.5 C82.8 48 80.6 51.5 78.7 52.5 C75.8 45 69 40.6 60 40.6 C51 40.6 44.3 45 41.3 52.5 Z"
            fill={NUIT}
            {...trait}
          />
          <path
            d="M44 46 C51 39.5 69.5 38.5 78.5 44.5 M45 35.5 C54 27 72 24.5 83.5 32 M49 25 C57.5 18.5 71.5 17.5 80.5 23"
            fill="none"
            {...trait}
          />
          <path
            d="M71 19.5 C69 10 80.5 6.5 85 12.5 C89 18 85 25 78.5 24.5 C75 24.2 72 22.5 71 19.5 Z"
            fill={NUIT}
            {...trait}
          />
          <path d="M74.5 18.5 C75 13.5 81 12 83 16" fill="none" {...trait} />
        </g>
      </g>
    </svg>
  );
}

/** Filets art déco de la page : double cadre, angles en gradins, chevrons sur les côtés. */
function FiletsArtDeco() {
  return (
    <svg
      viewBox="0 0 105 148"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
      fill="none"
      stroke={OR}
      strokeWidth="0.22"
      aria-hidden
    >
      <g opacity="0.55">
        <rect x="3.5" y="3.5" width="98" height="141" />
        <path d="M5.5 14 V5.5 H14 M91 5.5 H99.5 V14 M99.5 134 V142.5 H91 M14 142.5 H5.5 V134" />
        <path d="M7.5 20 V7.5 H20 M85 7.5 H97.5 V20 M97.5 128 V140.5 H85 M20 140.5 H7.5 V128" />
        <path d="M30 3.5 L34 7.5 H71 L75 3.5 M30 144.5 L34 140.5 H71 L75 144.5" />
      </g>
      <g opacity="0.4">
        <path d="M0 62 L6 74 L0 86 M0 66 L4 74 L0 82 M105 62 L99 74 L105 86 M105 66 L101 74 L105 82" />
      </g>
    </svg>
  );
}

/** Ornements dans les angles du cadre du QR code. */
function CoinsCadre() {
  const coin = "absolute size-[7cqw] border-[0.25cqw]";
  const style = { borderColor: OR };
  return (
    <>
      <span className={`${coin} start-[1cqw] top-[1cqw] border-e-0 border-b-0`} style={style} aria-hidden />
      <span className={`${coin} end-[1cqw] top-[1cqw] border-s-0 border-b-0`} style={style} aria-hidden />
      <span className={`${coin} start-[1cqw] bottom-[1cqw] border-e-0 border-t-0`} style={style} aria-hidden />
      <span className={`${coin} end-[1cqw] bottom-[1cqw] border-s-0 border-t-0`} style={style} aria-hidden />
    </>
  );
}

/** Format d'impression : une page A6 par chevalet, pleine page, couleurs conservées. */
export function StylesImpressionChevalets() {
  return (
    <style>{`
      @page { size: 105mm 148mm; margin: 0; }
      @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `}</style>
  );
}
