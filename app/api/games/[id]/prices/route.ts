import { NextResponse } from "next/server";
import { loadGameHistory } from "@/lib/prices/cached";
import { parseGameId } from "@/lib/prices/history";

/** Price history for the panel under a game's row. Fetched only when a row is opened. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bggId = parseGameId((await params).id);
  if (bggId === null) return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  return NextResponse.json(await loadGameHistory(bggId));
}
