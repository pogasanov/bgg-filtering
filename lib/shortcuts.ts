export type ShortcutEvent = {
  key: string;
  /** Physical key, independent of the keyboard layout. */
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/**
 * True for the "focus search" shortcuts: "/" (not while typing) and Ctrl/Cmd+K (always).
 * Matches the physical key as well as the character, so it also works on a Russian layout,
 * where those keys produce "." and "л".
 */
export function isSearchShortcut(event: ShortcutEvent, typing: boolean): boolean {
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && !event.altKey && (event.code === "KeyK" || event.key.toLowerCase() === "k")) return true;
  if (typing || modifier || event.altKey || event.shiftKey) return false;
  return event.code === "Slash" || event.key === "/";
}
