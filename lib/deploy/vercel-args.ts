/**
 * Arguments for the Vercel CLI that always authenticate with this project's own account
 * (VERCEL_TOKEN), never with whatever account the global `vercel login` points at.
 */
export function buildVercelArgs(args: string[], token: string | undefined): string[] {
  if (!token) throw new Error("VERCEL_TOKEN is not set");
  if (args.some((arg) => arg === "--token" || arg.startsWith("--token=") || arg === "-t")) {
    throw new Error("Pass the token through VERCEL_TOKEN, not --token");
  }
  return [...args, "--token", token];
}
