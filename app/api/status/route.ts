import { NextResponse } from "next/server";
import { createCacheStore } from "@/lib/cache/store";

export const dynamic = "force-dynamic";

export function GET() {
  const store = createCacheStore();
  try {
    return NextResponse.json(store.getStatus());
  } finally {
    store.close();
  }
}
