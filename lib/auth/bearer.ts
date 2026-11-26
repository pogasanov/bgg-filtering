import { timingSafeEqual } from "node:crypto";

/** True when the request carries `Authorization: Bearer <secret>`. An empty secret never matches. */
export function hasValidBearer(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
