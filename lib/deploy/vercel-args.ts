export type VercelAuth = {
  /** A token from the project's Vercel account, for non-interactive use (CI). Optional. */
  token?: string;
  /** The CLI's config directory for this project, so `vercel login` never touches the global login. */
  globalConfigDir: string;
};

const RESERVED_FLAGS = ["--token", "-t", "--global-config", "-Q"];

/**
 * Arguments for the Vercel CLI that always use this project's own Vercel account: its CLI login
 * lives in a dedicated config directory, and VERCEL_TOKEN, when set, is passed on top.
 */
export function buildVercelArgs(args: string[], auth: VercelAuth): string[] {
  if (args.some((arg) => RESERVED_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`)))) {
    throw new Error("pnpm vc picks the project's Vercel login itself; do not pass --token or --global-config");
  }
  const withConfig = [...args, "--global-config", auth.globalConfigDir];
  return auth.token ? [...withConfig, "--token", auth.token] : withConfig;
}
