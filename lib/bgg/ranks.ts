import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TopRankItem } from "./types";

const REQUIRED_COLUMNS = [
  "id",
  "name",
  "yearpublished",
  "rank",
  "bayesaverage",
  "average",
  "usersrated",
  "is_expansion",
] as const;

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field);
  return fields;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRanksCsv(csv: string, limit = 500): TopRankItem[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  const headers = parseCsvRow(lines[0] ?? "").map((header) => header.replace(/^\uFEFF/, ""));
  const indexes = new Map(headers.map((header, index) => [header, index]));
  const missing = REQUIRED_COLUMNS.filter((column) => !indexes.has(column));

  if (missing.length > 0) {
    throw new Error(`BGG ranks CSV is missing required columns: ${missing.join(", ")}`);
  }

  const value = (row: string[], column: (typeof REQUIRED_COLUMNS)[number]) =>
    row[indexes.get(column)!];

  return lines
    .slice(1)
    .map(parseCsvRow)
    .filter((row) => value(row, "is_expansion") === "0")
    .flatMap((row): TopRankItem[] => {
      const id = numberOrNull(value(row, "id"));
      const rank = numberOrNull(value(row, "rank"));
      const title = value(row, "name");
      if (id === null || rank === null || rank < 1 || !title) return [];

      return [{
        id,
        rank,
        title,
        year: numberOrNull(value(row, "yearpublished")),
        geekRating: numberOrNull(value(row, "bayesaverage")),
        averageRating: numberOrNull(value(row, "average")),
        numVoters: numberOrNull(value(row, "usersrated")),
      }];
    })
    .sort((left, right) => left.rank - right.rank)
    .slice(0, limit);
}

export async function loadTopRankItems(
  limit = 500,
  csvPath = process.env.BGG_RANKS_CSV_PATH ?? "boardgames_ranks.csv",
): Promise<{ items: TopRankItem[]; rawPayload: string }> {
  const absolutePath = resolve(csvPath);
  let csv: string;

  try {
    csv = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read BGG ranks CSV at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const items = parseRanksCsv(csv, limit);
  if (items.length === 0) {
    throw new Error(`BGG ranks CSV at ${absolutePath} contains no ranked base games.`);
  }

  return { items, rawPayload: JSON.stringify(items) };
}
