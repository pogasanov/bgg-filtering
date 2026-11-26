type Rule = { allow: boolean; pattern: string; regex: RegExp };

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Rules of every group that applies to all agents (`User-agent: *`). */
function rulesForAllAgents(robotsTxt: string): Rule[] {
  const rules: Rule[] = [];
  let groupAgents: string[] = [];
  let groupHasRules = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (groupHasRules) {
        groupAgents = [];
        groupHasRules = false;
      }
      groupAgents.push(value);
      continue;
    }

    if (field !== "allow" && field !== "disallow") continue;
    groupHasRules = true;
    if (!groupAgents.includes("*") || value === "") continue;
    rules.push({ allow: field === "allow", pattern: value, regex: patternToRegex(value) });
  }

  return rules;
}

/**
 * Whether `robots.txt` lets a generic crawler request this path (with its query string).
 * The longest matching rule wins; on a tie Allow beats Disallow.
 */
export function isAllowedByRobots(robotsTxt: string, pathWithQuery: string): boolean {
  let winner: Rule | null = null;

  for (const rule of rulesForAllAgents(robotsTxt)) {
    if (!rule.regex.test(pathWithQuery)) continue;
    const longer = winner === null || rule.pattern.length > winner.pattern.length;
    const tieForAllow = winner !== null && rule.pattern.length === winner.pattern.length && rule.allow;
    if (longer || tieForAllow) winner = rule;
  }

  return winner === null || winner.allow;
}
