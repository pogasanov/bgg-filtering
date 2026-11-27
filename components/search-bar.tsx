"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { AppFilterRail } from "@/components/filters/app-filter-rail";
import { useGames } from "@/components/games-state";
import { LocaleSwitch, useMessages } from "@/components/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isSearchShortcut } from "@/lib/shortcuts";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Title search and, on phones, the button that opens the filters. */
export function SearchBar() {
  const { filters, setFilters, chips } = useGames();
  const t = useMessages();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event, isTypingTarget(event.target))) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    // Pinned so search and the phone filter button stay reachable; above the poll strips (z-10).
    <div data-search-bar className="sticky top-0 z-20 flex gap-2 border-b bg-background px-4 py-2.5">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          ref={searchRef}
          type="search"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchAria}
          aria-keyshortcuts="/ Control+K Meta+K"
          className="h-9 pr-10 pl-9 text-[13px] shadow-none md:text-[13px]"
        />
        <kbd
          className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] text-muted-foreground lg:block"
          aria-hidden="true"
        >
          /
        </kbd>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="h-9 gap-1.5 shadow-none lg:hidden"
            aria-label={chips.length > 0 ? t.filtersWithActive(chips.length) : t.filters}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t.filters}
            {chips.length > 0 ? <span className="font-mono text-xs">{chips.length}</span> : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[320px] gap-0 overflow-hidden p-0 sm:max-w-[320px]">
          {/* On phones the top bar has no room for the language switch, so it lives here. */}
          <SheetHeader className="flex-row items-center gap-3 border-b py-2.5 pr-12 pl-4">
            <SheetTitle className="mr-auto text-sm">{t.filters}</SheetTitle>
            <LocaleSwitch className="h-8 [&>*]:h-8" />
            <SheetDescription className="sr-only">{t.filtersDescription}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <AppFilterRail />
          </div>
        </SheetContent>
      </Sheet>

      <LocaleSwitch className="hidden lg:flex" />
    </div>
  );
}
