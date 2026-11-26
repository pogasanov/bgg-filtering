export const PAGE_SIZE = 100;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** A page number that exists for this many items: out-of-range and garbage values land on the nearest page. */
export function clampPage(page: number, total: number): number {
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, pageCount(total));
}

export function pageSlice<Item>(items: Item[], page: number): Item[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

export type PageItem = number | "gap";

/** The page links to show: the first, the last and the neighbours of the current page, with gaps between. */
export function pageItems(page: number, count: number): PageItem[] {
  const shown = new Set([1, count, page - 1, page, page + 1].filter((item) => item >= 1 && item <= count));
  const items: PageItem[] = [];
  let previous = 0;
  for (const item of [...shown].sort((a, b) => a - b)) {
    // A gap of one page is shown as that page: an ellipsis would take the same room.
    if (item - previous === 2) items.push(previous + 1);
    else if (item - previous > 2) items.push("gap");
    items.push(item);
    previous = item;
  }
  return items;
}
