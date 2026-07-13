import { BggApp } from "@/components/bgg-app";
import { createCacheStore } from "@/lib/cache/store";

export const dynamic = "force-dynamic";

export default function Page() {
  const store = createCacheStore();
  try {
    return <BggApp initialGames={store.getGames()} initialStatus={store.getStatus()} />;
  } finally {
    store.close();
  }
}
