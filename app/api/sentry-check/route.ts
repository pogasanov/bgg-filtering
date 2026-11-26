import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/auth/bearer";

/** Throws on purpose so the owner can confirm site errors reach Sentry. Guarded by REVALIDATE_SECRET. */
export async function GET(request: Request) {
  if (!hasValidBearer(request, process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  throw new Error("Sentry check: deliberate site error");
}
