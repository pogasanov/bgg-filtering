import type { GameHistory, ShopHistory } from "./history";
import type { ShopCode } from "./types";

export const chartRanges = ["30d", "90d", "1y", "all"] as const;
export type ChartRange = (typeof chartRanges)[number];

export const chartRangeLabels: Record<ChartRange, string> = {
  "30d": "30 дней",
  "90d": "90 дней",
  "1y": "Год",
  all: "Всё",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const rangeDays: Record<ChartRange, number | null> = { "30d": 30, "90d": 90, "1y": 365, all: null };

/** One moment on the chart. A shop's value is a price, null for a gap, or absent outside its line. */
export type ChartRow = { t: number } & Partial<Record<ShopCode, number | null>>;

export type ChartSeries = {
  rows: ChartRow[];
  /** Shops that have something to draw in this range. */
  shops: ShopCode[];
  /** Real observations in the range, not counting the rows added at its edges. */
  pointCount: number;
  /** Per shop, the times at which a price was actually observed: where a point marker belongs. */
  observed: Partial<Record<ShopCode, number[]>>;
};

/** `seen` is when the shop was read; `t` is where the step takes effect on the chart. */
type Step = { t: number; seen: number; value: number | null };

/** A shop's line: each step holds until the next, and the last one until the last successful check. */
function steps(shop: ShopHistory): { steps: Step[]; end: number } | null {
  if (shop.points.length === 0) return null;
  const list: Step[] = [];
  for (const point of shop.points) {
    const seen = Date.parse(point.at);
    // Out of stock or unpriced breaks the line instead of drawing a price nobody could pay.
    const value = point.available === false ? null : point.price;
    const previous = list[list.length - 1];
    // A stepped line only runs as far as its next drawn point. So the price before a gap is drawn
    // up to the moment the gap was seen, and the gap itself begins an instant later.
    const startsGap = value === null && previous !== undefined && previous.value !== null;
    list.push({ t: startsGap ? seen + 1 : seen, seen, value });
  }
  const last = list[list.length - 1].t;
  const checked = shop.checkedAt === null ? last : Date.parse(shop.checkedAt);
  return { steps: list, end: Math.max(last, checked) };
}

function valueAt(line: { steps: Step[]; end: number }, t: number): number | null | undefined {
  if (t < line.steps[0].t || t > line.end) return undefined;
  let value: number | null = null;
  for (const step of line.steps) {
    if (step.t > t) break;
    value = step.value;
  }
  return value;
}

/** Rows for a stepped multi-line chart of one game's prices over the chosen range. */
export function chartSeries(history: GameHistory, range: ChartRange, now: Date): ChartSeries {
  const days = rangeDays[range];
  const start = days === null ? Number.NEGATIVE_INFINITY : now.getTime() - days * DAY_MS;

  const lines = history.shops.flatMap((shop) => {
    const line = steps(shop);
    return line === null ? [] : [{ shop: shop.shop, ...line }];
  });

  const times = new Set<number>();
  let pointCount = 0;
  for (const line of lines) {
    for (const step of line.steps) {
      if (step.seen < start) continue;
      times.add(step.seen);
      times.add(step.t);
      pointCount += 1;
    }
    if (line.end >= start) times.add(line.end);
    // A line that began before the range enters it at the price it had then.
    if (line.steps[0].t < start && line.end >= start) times.add(start);
  }

  const rows = [...times]
    .sort((a, b) => a - b)
    .map((t) => {
      const row: ChartRow = { t };
      for (const line of lines) {
        const value = valueAt(line, t);
        if (value !== undefined) row[line.shop] = value;
      }
      return row;
    });

  const observed: ChartSeries["observed"] = {};
  for (const line of lines) {
    const seen = line.steps.filter((step) => step.value !== null && step.seen >= start).map((step) => step.seen);
    if (seen.length > 0) observed[line.shop] = seen;
  }

  return {
    rows,
    observed,
    shops: lines.filter((line) => rows.some((row) => row[line.shop] !== undefined)).map((line) => line.shop),
    pointCount,
  };
}
