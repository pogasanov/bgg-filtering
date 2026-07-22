export function buildYearScale(years: readonly (number | null)[]): number[] {
  return [...new Set(years.filter((year): year is number => year !== null))].sort(
    (left, right) => left - right,
  );
}

export function closestYear(years: readonly number[], target: number): number | null {
  if (years.length === 0) return null;

  return years.reduce((closest, candidate) =>
    Math.abs(candidate - target) < Math.abs(closest - target) ? candidate : closest,
  );
}

export function positionForYear(years: readonly number[], year: number): number | null {
  const resolvedYear = closestYear(years, year);
  return resolvedYear === null ? null : years.indexOf(resolvedYear) + 1;
}

export function yearAtPosition(years: readonly number[], position: number): number | null {
  return years[position - 1] ?? null;
}
