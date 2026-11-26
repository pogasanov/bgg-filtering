const namedEntities: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
};

/** Decodes the HTML entities shops actually use in titles; unknown ones are left as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return namedEntities[body.toLowerCase()] ?? whole;
  });
}

/** Text content of an HTML fragment: tags removed, entities decoded, whitespace collapsed. */
export function textContent(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Every opening tag of the given element, as written. */
export function openingTags(html: string, element: string): string[] {
  return html.match(new RegExp(`<${element}\\b[^>]*>`, "gi")) ?? [];
}

/** The decoded value of an attribute on an opening tag, or `null` when absent. */
export function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? decodeEntities(match[1] ?? match[2] ?? "") : null;
}

export function hasClass(tag: string, className: string): boolean {
  return (attribute(tag, "class") ?? "").split(/\s+/).includes(className);
}
