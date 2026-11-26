import { expect, test } from "vitest";
import { isSearchShortcut } from "@/lib/shortcuts";

const plain = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

test("slash focuses search unless the user is typing", () => {
  expect(isSearchShortcut({ ...plain, key: "/", code: "Slash" }, false)).toBe(true);
  expect(isSearchShortcut({ ...plain, key: "/", code: "Slash" }, true)).toBe(false);
});

test("works on a Russian keyboard layout, where the same keys produce other characters", () => {
  expect(isSearchShortcut({ ...plain, key: ".", code: "Slash" }, false)).toBe(true);
  expect(isSearchShortcut({ ...plain, key: "л", code: "KeyK", ctrlKey: true }, true)).toBe(true);
  expect(isSearchShortcut({ ...plain, key: ",", code: "Slash", shiftKey: true }, false)).toBe(false);
});

test("Ctrl+K and Cmd+K work even while typing; a bare K does not", () => {
  expect(isSearchShortcut({ ...plain, key: "k", code: "KeyK", ctrlKey: true }, true)).toBe(true);
  expect(isSearchShortcut({ ...plain, key: "k", code: "KeyK", metaKey: true }, false)).toBe(true);
  expect(isSearchShortcut({ ...plain, key: "k", code: "KeyK" }, false)).toBe(false);
});
