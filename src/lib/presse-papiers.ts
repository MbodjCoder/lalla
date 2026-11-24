// Copie dans le presse-papiers, y compris hors HTTPS (navigator.clipboard n'existe
// alors pas) : repli sur un texte sélectionné puis copié avec execCommand.

export async function copierTexte(texte: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texte);
      return true;
    } catch {
      // Refus du navigateur : on tente le repli
    }
  }
  return copierParSelection(texte);
}

// Un simple élément de texte (pas un champ) : sa sélection fonctionne partout,
// iPhone compris. Le texte doit exister dans le document pour être copié.
function copierParSelection(texte: string): boolean {
  const porteur = document.createElement("span");
  porteur.textContent = texte;
  Object.assign(porteur.style, {
    position: "fixed",
    top: "0",
    left: "0",
    whiteSpace: "pre",
    userSelect: "text",
    webkitUserSelect: "text",
    opacity: "0.01",
    pointerEvents: "none",
  });
  document.body.appendChild(porteur);

  const selection = window.getSelection();
  const plage = document.createRange();
  plage.selectNodeContents(porteur);
  selection?.removeAllRanges();
  selection?.addRange(plage);

  let reussi = false;
  try {
    // Le navigateur peut répondre « oui » sans rien copier : on vérifie la sélection
    reussi = selection?.toString() === texte && document.execCommand("copy");
  } catch {
    reussi = false;
  }
  selection?.removeAllRanges();
  porteur.remove();
  return reussi;
}
