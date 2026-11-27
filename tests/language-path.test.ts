import { expect, test } from "vitest";
import { languageFromSlug, languagePath, languageSlug, viewHref } from "@/lib/language-path";
import { defaultFilters } from "@/lib/url-state";

const languages = ["English", "German", "Chinese (Traditional)"];

test("every edition lives at the root, each language under its own prefix", () => {
  expect(languagePath("")).toBe("/");
  expect(languagePath("Russian")).toBe("/ru");
  expect(languagePath("English")).toBe("/en");
  expect(languagePath("German")).toBe("/de");
  expect(languagePath("Chinese (Traditional)")).toBe("/chinese-traditional");
});

test("every prefix leads back to its language", () => {
  for (const language of ["Russian", ...languages]) {
    expect(languageFromSlug(languageSlug(language), languages)).toBe(language);
  }
  // The old address of every edition, which next.config.ts redirects to "/".
  expect(languageFromSlug("any", languages)).toBe("");
  expect(languageFromSlug("xx", languages)).toBeNull();
});

test("the address carries the language in the path and the rest in the query", () => {
  expect(viewHref(defaultFilters)).toBe("/");
  expect(viewHref(defaultFilters, 2)).toBe("/?page=2");
  expect(viewHref({ ...defaultFilters, language: "English" })).toBe("/en");
  expect(viewHref({ ...defaultFilters, language: "English", minYear: 2010 }, 3)).toBe("/en?ymin=2010&page=3");
  expect(viewHref({ ...defaultFilters, language: "Russian" }, 2)).toBe("/ru?page=2");
});
