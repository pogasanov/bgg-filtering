export function PoweredByBgg() {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by BoardGameGeek"
      className="inline-flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-[#34305a] shadow-sm transition-colors hover:bg-[var(--muted)]"
    >
      <span className="flex h-9 w-9 items-center justify-center bg-[#ff5100] text-sm font-black text-white">
        BGG
      </span>
      <span className="leading-none">
        <span className="block text-[0.65rem] font-bold uppercase tracking-wide">Powered by</span>
        <span className="block text-lg font-black uppercase tracking-normal">BGG</span>
      </span>
    </a>
  );
}
