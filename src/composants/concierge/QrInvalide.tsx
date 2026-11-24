import { traducteurClient } from "@/lib/i18n/client";

// Écran affiché pour un QR révoqué, inconnu ou d'un hôtel désactivé.
export function QrInvalide() {
  const t = traducteurClient("fr");
  return (
    <main className="grid min-h-dvh place-items-center px-8">
      <div className="max-w-sm animate-apparition text-center">
        <p className="font-serif text-[64px] italic leading-none text-encre-pale">L</p>
        <h1 className="mt-6 font-serif text-[30px] leading-tight text-encre">{t("qrInvalideTitre")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-encre-douce">{t("qrInvalideTexte")}</p>
      </div>
    </main>
  );
}
