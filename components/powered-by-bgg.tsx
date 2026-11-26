/** The linked BGG mark required by the API terms. Its orange is the one brand colour in the interface. */
export function PoweredByBgg() {
  return (
    <a
      href="https://boardgamegeek.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by BoardGameGeek"
      className="inline-flex w-fit items-center gap-2 rounded-sm text-foreground outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex h-6 w-8 items-center justify-center bg-[#ff5100] text-[10px] font-black text-white">
        BGG
      </span>
      <span className="text-[11px] font-semibold tracking-wide uppercase">Powered by BGG</span>
    </a>
  );
}
