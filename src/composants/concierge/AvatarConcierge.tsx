"use client";

import { useId } from "react";

// Portrait de la concierge : illustration vectorielle, souriante et regard ouvert.
// Foulard (moussor) noué sur le côté, aux couleurs de l'hôtel via la variable d'accent ;
// tailleur sombre à col blanc, créoles et broche dorées.
type Proprietes = {
  taille?: number;
  enLigne?: boolean; // pastille verte « disponible »
  className?: string;
};

const ENCRE_TRAITS = "#2a1810";
const OR = "#d6b263";
const OMBRE_ACCENT = "color-mix(in oklab, var(--accent-hotel) 72%, black)";

export function AvatarConcierge({ taille = 40, enLigne = false, className = "" }: Proprietes) {
  // Identifiants uniques : plusieurs avatars peuvent coexister dans la page
  const id = useId().replace(/:/g, "");
  const cadre = `cadre-${id}`;
  const peau = `peau-${id}`;
  const fond = `fond-${id}`;
  const foulard = `foulard-${id}`;
  const veste = `veste-${id}`;

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: taille, height: taille }}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" width={taille} height={taille} className="block">
        <defs>
          <clipPath id={cadre}>
            <circle cx="60" cy="60" r="60" />
          </clipPath>
          <linearGradient id={peau} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b07a52" />
            <stop offset="1" stopColor="#94603d" />
          </linearGradient>
          <linearGradient id={fond} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0"
              style={{
                stopColor: "color-mix(in oklab, var(--accent-hotel) 8%, white)",
              }}
            />
            <stop
              offset="1"
              style={{
                stopColor: "color-mix(in oklab, var(--accent-hotel) 24%, white)",
              }}
            />
          </linearGradient>
          <linearGradient id={foulard} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              style={{
                stopColor: "color-mix(in oklab, var(--accent-hotel) 88%, white)",
              }}
            />
            <stop offset="1" style={{ stopColor: "var(--accent-hotel)" }} />
          </linearGradient>
          <linearGradient id={veste} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2f3d" />
            <stop offset="1" stopColor="#1b1f2a" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${cadre})`}>
          <rect width="120" height="120" fill={`url(#${fond})`} />

          {/* Cadrage serré : le portrait occupe le cercle */}
          <g transform="translate(60 65.5) scale(1.27) translate(-60 -58)">
            {/* Buste : tailleur sombre, chemisier blanc, broche dorée */}
            <path d="M2 124 C6 97 29 83.5 60 83.5 C91 83.5 114 97 118 124 Z" fill={`url(#${veste})`} />
            <path d="M49.5 84 L60 99.5 L70.5 84 Z" fill="#fbfaf6" />
            <path d="M44 85 L60 104.5 L52 84.1 Z" fill="#363c4d" />
            <path d="M76 85 L60 104.5 L68 84.1 Z" fill="#363c4d" />
            <circle cx="81" cy="96" r="1.9" fill={OR} />
            <circle cx="81" cy="96" r="0.75" fill="#f5e3ad" />

            {/* Cou */}
            <path d="M52.5 72 L52.5 83.5 Q60 88.5 67.5 83.5 L67.5 72 Z" fill={`url(#${peau})`} />
            <path d="M52.5 75.5 Q60 82 67.5 75.5 L67.5 72.5 Q60 79 52.5 72.5 Z" fill="#6f4229" opacity="0.38" />

            {/* Oreilles et créoles dorées */}
            <ellipse cx="43.6" cy="57.5" rx="2.8" ry="4.5" fill="#9a6441" />
            <ellipse cx="76.4" cy="57.5" rx="2.8" ry="4.5" fill="#9a6441" />
            <circle cx="43.4" cy="65.2" r="3" fill="none" stroke={OR} strokeWidth="1.4" />
            <circle cx="76.6" cy="65.2" r="3" fill="none" stroke={OR} strokeWidth="1.4" />

            {/* Visage */}
            <path
              d="M44 54.5 C44 42 51.2 36 60 36 C68.8 36 76 42 76 54.5 C76 67 69.3 76.5 60 76.5 C50.7 76.5 44 67 44 54.5 Z"
              fill={`url(#${peau})`}
            />

            {/* Sourcils fins et arqués */}
            <path
              d="M50.4 50 Q53.9 47.4 57.4 49"
              stroke={ENCRE_TRAITS}
              strokeWidth="1.25"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M62.6 49 Q66.1 47.4 69.6 50"
              stroke={ENCRE_TRAITS}
              strokeWidth="1.25"
              fill="none"
              strokeLinecap="round"
            />

            {/* Yeux ouverts, regard bienveillant, cils */}
            <path d="M50.6 55 Q54.1 51.9 57.6 55 Q54.1 57.5 50.6 55 Z" fill="#fffdf8" />
            <path d="M62.4 55 Q65.9 51.9 69.4 55 Q65.9 57.5 62.4 55 Z" fill="#fffdf8" />
            <circle cx="54.2" cy="54.8" r="2.05" fill={ENCRE_TRAITS} />
            <circle cx="65.8" cy="54.8" r="2.05" fill={ENCRE_TRAITS} />
            <circle cx="54.9" cy="54.1" r="0.62" fill="#ffffff" />
            <circle cx="66.5" cy="54.1" r="0.62" fill="#ffffff" />
            <path
              d="M57.8 55 Q54.1 51.6 50.4 54.9 L49.4 54.1"
              stroke={ENCRE_TRAITS}
              strokeWidth="1.15"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M62.2 55 Q65.9 51.6 69.6 54.9 L70.6 54.1"
              stroke={ENCRE_TRAITS}
              strokeWidth="1.15"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Nez : ombre des narines, reflet sur l'arête */}
            <path d="M57.9 62.4 Q60 64.6 62.1 62.4 Q60 63.4 57.9 62.4 Z" fill="#6b3d26" opacity="0.75" />
            <ellipse cx="60.4" cy="60.6" rx="0.7" ry="1.4" fill="#c99a72" opacity="0.55" />

            {/* Sourire chaleureux */}
            <path d="M54 67.4 Q60 74.4 66 67.4 Q60 69.7 54 67.4 Z" fill="#7e3229" />
            <path d="M55.3 68 Q60 70.4 64.7 68 Q60 69.1 55.3 68 Z" fill="#ffffff" />
            <path
              d="M56.8 71.2 Q60 72.7 63.2 71.2"
              stroke="#b35a4b"
              strokeWidth="0.85"
              fill="none"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* Pommettes */}
            <ellipse cx="50.2" cy="62.4" rx="3.3" ry="1.9" fill="#d98466" opacity="0.3" />
            <ellipse cx="69.8" cy="62.4" rx="3.3" ry="1.9" fill="#d98466" opacity="0.3" />

            {/* Foulard : une forme enveloppante, plis en diagonale */}
            <path
              d="M41.3 52.5 C36.5 31 46 15.5 62 14.5 C78.5 13.5 89.5 26.5 84.5 42.5 C82.8 48 80.6 51.5 78.7 52.5 C75.8 45 69 40.6 60 40.6 C51 40.6 44.3 45 41.3 52.5 Z"
              fill={`url(#${foulard})`}
            />
            <g style={{ fill: OMBRE_ACCENT }}>
              <path opacity="0.42" d="M43 46.5 C49.5 38.6 69.5 37.5 78.5 44.5 C68 40 52 40.4 43 46.5 Z" />
              <path opacity="0.32" d="M44 36 C53 26.5 72 24 84 32 C72 27.8 55 29.2 44 36 Z" />
              <path opacity="0.28" d="M48 25 C57 17.5 72 16.5 81.5 23 C71 19.6 58 20.6 48 25 Z" />
            </g>
            {/* Nœud torsadé en haut à droite */}
            <path
              d="M71 19.5 C69 10 80.5 6.5 85 12.5 C89 18 85 25 78.5 24.5 C75 24.2 72 22.5 71 19.5 Z"
              fill={`url(#${foulard})`}
            />
            <path
              d="M74.5 18.5 C75 13.5 81 12 83 16 C84.5 19.5 81.5 22.5 78 21.8 C76.3 21.4 74.9 20.2 74.5 18.5 Z"
              style={{ fill: OMBRE_ACCENT }}
              opacity="0.4"
            />
            {/* Reflet du tissu */}
            <path
              d="M49.5 21 C55 15.8 64 14.5 71.5 16"
              stroke="#ffffff"
              strokeOpacity="0.38"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
      {enLigne && (
        <span
          className="absolute rounded-full bg-succes ring-2 ring-fond"
          style={{
            width: taille * 0.22,
            height: taille * 0.22,
            right: taille * 0.03,
            bottom: taille * 0.03,
          }}
        />
      )}
    </span>
  );
}
