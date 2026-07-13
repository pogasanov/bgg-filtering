import { NextResponse } from "next/server";
import { syncBggCache } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncBggCache(500);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
