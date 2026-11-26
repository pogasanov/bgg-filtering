import { Suspense, type ReactNode } from "react";
import { CatalogShell } from "@/components/catalog-shell";
import { loadCatalogFrame } from "@/lib/catalog/cached";

/**
 * The frame shared by the static first page and the filtered view: the rail, the search bar and the
 * state behind them. Living in the layout, they keep their state when a filter moves the visitor
 * from one route to the other.
 */
export default async function CatalogLayout({ children }: { children: ReactNode }) {
  const frame = await loadCatalogFrame();
  return (
    // On the filtered view the controls read the URL, which is only known per request; the boundary
    // lets that wait. Nothing suspends on the static first page, so its HTML is complete.
    <Suspense>
      <CatalogShell frame={frame}>{children}</CatalogShell>
    </Suspense>
  );
}
