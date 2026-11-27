import { expect, test } from "vitest";
import { changedFilterGroups, filterProperties, linkHost, normalizeSearch, searchProperties } from "@/lib/analytics";
import { defaultFilters } from "@/lib/url-state";

test("the default filters: only the language, and one readable combination", () => {
  const props = filterProperties(defaultFilters);
  expect(props.filters_active).toEqual(["language"]);
  expect(props.filters_combo).toBe("lang=Russian");
  expect(props.filter_sort).toBe("rank:asc");
  expect(props.filter_search).toBeNull();
});

test("the combination is the same whatever order the filters were picked in", () => {
  const a = filterProperties({
    ...defaultFilters,
    language: "",
    tags: ["Economic", "Cooperative"],
    matrix: [
      { playerCount: "3", verdict: "best" },
      { playerCount: "2", verdict: "best" },
    ],
    minYear: 2015,
    maxYear: null,
    search: "  catan ",
  });
  const b = filterProperties({
    ...defaultFilters,
    language: "",
    tags: ["Cooperative", "Economic"],
    matrix: [
      { playerCount: "2", verdict: "best" },
      { playerCount: "3", verdict: "best" },
    ],
    minYear: 2015,
    maxYear: null,
    search: "catan",
  });
  expect(a).toEqual(b);
  expect(a.filters_combo).toBe("lang=any; m=2:best,3:best; tags=Cooperative|Economic; years=2015-; q=catan");
  expect(a.filters_active).toEqual(["search", "tags", "matrix", "years"]);
  expect(a.filter_matrix_count).toBe(2);
});

test("names the groups that changed", () => {
  expect(changedFilterGroups(defaultFilters, defaultFilters)).toEqual([]);
  expect(
    changedFilterGroups(defaultFilters, { ...defaultFilters, tags: ["Cooperative"], sort: "price", sortDir: "asc", maxYear: 2020 }),
  ).toEqual(["tags", "years", "sort"]);
  expect(changedFilterGroups(defaultFilters, { ...defaultFilters, language: "" })).toEqual(["language"]);
});

test("link host", () => {
  expect(linkHost("https://www.lavkaigr.ru/p/1")).toBe("www.lavkaigr.ru");
  expect(linkHost("not a url")).toBeNull();
});

test("search properties fold case and spaces, and say whether anything matched", () => {
  expect(searchProperties("  Каркассон   Охотники ", 0, "")).toEqual({
    search_query: "Каркассон   Охотники",
    search_query_normalized: "каркассон охотники",
    search_length: 20,
    results_count: 0,
    has_results: false,
    filter_language: "any",
  });
  expect(normalizeSearch("Catan")).toBe(normalizeSearch(" catan "));
  expect(searchProperties("catan", 3, "Russian").has_results).toBe(true);
});
