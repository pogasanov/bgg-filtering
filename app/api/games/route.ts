import { NextResponse } from "next/server";
import { createCacheStore } from "@/lib/cache/store";

export const dynamic = "force-dynamic";

export function GET() {
  const store = createCacheStore();
  try {
    return NextResponse.json({ games: store.getListedGames() });
  } finally {
    store.close();
  }
}
