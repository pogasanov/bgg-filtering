"use client";

import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMessages } from "@/components/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type FilterGroupProps = {
  title: string;
  /** Short text shown in the header, e.g. the current year range. */
  summary?: string;
  activeCount?: number;
  onClear?: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

function GroupStatus({ title, summary, activeCount = 0, onClear }: Omit<FilterGroupProps, "children">) {
  const t = useMessages();
  return (
    <>
      {summary ? <span className="font-mono text-[11px] font-normal text-muted-foreground">{summary}</span> : null}
      {activeCount > 0 && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={t.clearGroup(title)}
          className="inline-flex items-center gap-0.5 rounded border px-1 font-mono text-[10px] leading-4 text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {activeCount}
          <X className="size-2.5" aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

/** A rail section: a hairline-separated block with a header, never a card. */
export function FilterGroup(props: FilterGroupProps) {
  const { title, collapsible = false, defaultOpen = true, children } = props;

  if (!collapsible) {
    return (
      <section className="border-b px-4 py-3">
        <div className="mb-2.5 flex items-center gap-2">
          <h2 className="mr-auto text-xs font-semibold">{title}</h2>
          <GroupStatus {...props} />
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/filter border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <CollapsibleTrigger className="mr-auto flex flex-1 items-center gap-1.5 rounded-sm text-left text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 group-data-[state=closed]/filter:font-medium group-data-[state=closed]/filter:text-muted-foreground">
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform group-data-[state=closed]/filter:-rotate-90"
            aria-hidden="true"
          />
          <h2>{title}</h2>
        </CollapsibleTrigger>
        <GroupStatus {...props} />
      </div>
      <CollapsibleContent className="pt-2.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}
