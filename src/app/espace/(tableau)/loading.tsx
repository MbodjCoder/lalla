// Affiché dès le toucher, pendant que la page se prépare : la navigation paraît instantanée
// (Next précharge cet écran avec chaque lien visible).
export default function Chargement() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2">
        <span className="size-12 rounded-full bg-creux" />
        <span className="mx-auto h-9 w-40 rounded-xl bg-creux" />
      </div>
      <div className="mx-auto mt-8 max-w-3xl space-y-3">
        <span className="block h-12 rounded-full bg-creux" />
        <span className="block h-24 rounded-[22px] bg-creux" />
        <span className="block h-24 rounded-[22px] bg-creux" />
        <span className="block h-24 rounded-[22px] bg-creux" />
      </div>
    </div>
  );
}
