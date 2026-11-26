import { BggApp } from "@/components/bgg-app";
import { loadCatalog } from "@/lib/catalog/load";

export const revalidate = 86400;

export default async function Page() {
  const catalog = await loadCatalog();
  return <BggApp games={catalog.games} status={catalog.status} />;
}
