import { Check, CheckCheck } from "lucide-react";

type Proprietes = {
  cote: "client" | "assistant";
  queue?: boolean; // premier message d'une série : coin pointu et petite pointe, comme WhatsApp
  heure?: string;
  statut?: "envoye" | "lu"; // coches des messages du client
  attenue?: boolean; // traduction en cours
  children: React.ReactNode;
};

// Bulle de discussion inspirée de WhatsApp : l'heure se loge en bas à droite,
// sur la dernière ligne si la place le permet, sinon juste en dessous.
export function Bulle({ cote, queue = false, heure, statut, attenue = false, children }: Proprietes) {
  const client = cote === "client";

  return (
    <div
      className={`relative min-w-0 rounded-[18px] px-3 pt-[7px] pb-[6px] texte-messages leading-[1.4] shadow-[0_1px_0.5px_rgb(26_27_23/0.1)] transition-opacity duration-300 ${
        client ? "bg-bulle-client text-texte-bulle-client" : "bg-bulle text-texte-bulle"
      } ${queue ? (client ? "rounded-se-[4px]" : "rounded-ss-[4px]") : ""} ${attenue ? "animate-pulse opacity-50" : ""}`}
    >
      {queue && (
        <svg
          viewBox="0 0 8 13"
          aria-hidden
          className={`absolute top-0 h-[13px] w-2 ${
            client ? "-end-2 text-bulle-client rtl:-scale-x-100" : "-start-2 -scale-x-100 text-bulle rtl:scale-x-100"
          }`}
        >
          <path d="M0 0H8Q4.5 3.5 0 13Z" fill="currentColor" />
        </svg>
      )}

      <div className="flex flex-wrap items-end gap-x-2.5">
        <div dir="auto" className="min-w-0 break-words">
          {children}
        </div>
        {heure && (
          <span
            className={`ms-auto flex translate-y-[3px] items-center gap-1 font-sans text-[11px] leading-none whitespace-nowrap tabular-nums ${
              client ? "text-texte-bulle-client-doux" : "text-texte-bulle-doux"
            }`}
          >
            {heure}
            {statut === "lu" && <CheckCheck className="icone-etat size-[15px] text-coche-lue" strokeWidth={2.2} />}
            {statut === "envoye" && <Check className="icone-etat size-[15px]" strokeWidth={2.2} />}
          </span>
        )}
      </div>
    </div>
  );
}

// Trois points animés : Lalla est en train d'écrire
export function PointsSaisie() {
  return (
    <span className="flex h-[21px] items-center gap-1.5 px-1">
      {[0, 1, 2].map((rang) => (
        <span
          key={rang}
          className="size-[7px] animate-pulsation rounded-full bg-texte-bulle/50"
          style={{ animationDelay: `${rang * 180}ms` }}
        />
      ))}
    </span>
  );
}
