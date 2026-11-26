const swatch = "inline-block size-3 rounded-[3px] align-[-2px]";

export function PollLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[11px] text-muted-foreground">
      <span>Опрос по числу игроков:</span>
      <span>
        <span className={`${swatch} bg-poll-best`} aria-hidden="true" /> лучше всего
      </span>
      <span>
        <span className={`${swatch} bg-poll-rec`} aria-hidden="true" /> рекомендуют
      </span>
      <span>
        <span className={`${swatch} border`} aria-hidden="true" /> не рекомендуют
      </span>
      <span>· нет данных</span>
      <span>бледный — вне диапазона игроков</span>
    </p>
  );
}
