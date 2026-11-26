import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/auth/bearer";
import { CATALOG_TAG } from "@/lib/catalog/load";

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET is not configured" }, { status: 500 });
  }
  if (!hasValidBearer(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(CATALOG_TAG, "max");
  revalidatePath("/");
  return NextResponse.json({ revalidated: true });
}
