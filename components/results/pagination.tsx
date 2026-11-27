"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMessages } from "@/components/locale";
import type { GameFilters } from "@/lib/filtering";
import { formatNumber } from "@/lib/labels";
import { viewHref } from "@/lib/language-path";
import { PAGE_SIZE, pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  /** How many games pass the filters, over all pages. */
  shown: number;
  filters: GameFilters;
};

const itemClass =
  "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function PageLink({ href, className, children, ...props }: { href: string; className?: string; children: ReactNode; "aria-label"?: string }) {
  // Replaces the history entry, as the filters do, so the back button leaves the page in one step.
  return (
    <Link href={href} replace prefetch={false} className={cn(itemClass, "hover:bg-muted", className)} {...props}>
      {children}
    </Link>
  );
}

/** Links to the other pages of the same filters. Nothing is shown while everything fits on one page. */
export function Pagination({ page, pageCount, shown, filters }: PaginationProps) {
  const t = useMessages();
  if (pageCount <= 1) return null;

  const href = (target: number) => viewHref(filters, target);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, shown);

  return (
    <nav
      aria-label={t.pagesAria}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3"
    >
      <p className="font-mono text-xs text-muted-foreground">
        {formatNumber(first, 0)}–{formatNumber(last, 0)} {t.ofTotal(formatNumber(shown, 0))}
      </p>
      <ul className="flex items-center gap-0.5">
        <li>
          {page > 1 ? (
            <PageLink href={href(page - 1)} aria-label={t.previousPage}>
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </PageLink>
          ) : null}
        </li>
        {pageItems(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className={cn(itemClass, "text-muted-foreground")}>
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span aria-current="page" className={cn(itemClass, "bg-foreground font-semibold text-background")}>
                  {item}
                </span>
              ) : (
                <PageLink href={href(item)} aria-label={t.pageN(item)}>
                  {item}
                </PageLink>
              )}
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <PageLink href={href(page + 1)} aria-label={t.nextPage}>
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </PageLink>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
