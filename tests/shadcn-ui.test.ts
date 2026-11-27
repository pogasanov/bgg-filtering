import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const root = new URL("../", import.meta.url);

function read(relativePath: string) {
  const url = new URL(relativePath, root);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("shadcn foundation", () => {
  test("checks in the generated supporting primitives", () => {
    const names = ["alert", "checkbox", "label", "scroll-area", "slider", "table"];

    for (const name of names) {
      expect(read(`components/ui/${name}.tsx`), `${name} should be generated`).toContain("data-slot=");
    }
  });

  test("uses the Tailwind v4 neutral shadcn theme", () => {
    const css = read("app/globals.css");
    const config = JSON.parse(read("components.json")) as {
      style: string;
      tailwind: { baseColor: string; config?: string };
      iconLibrary?: string;
    };

    expect(css).toContain('@import "tw-animate-css"');
    expect(css).toContain('@import "shadcn/tailwind.css"');
    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-background: var(--background)");
    expect(css).not.toContain(".year-range-input");
    expect(config).toMatchObject({
      style: "new-york",
      tailwind: { baseColor: "neutral", config: "" },
      iconLibrary: "lucide",
    });
  });

  test("ships the redesign foundation", () => {
    const css = read("app/globals.css");
    const layout = read("app/layout.tsx");
    for (const name of ["sheet", "collapsible", "toggle", "toggle-group", "tooltip"]) {
      expect(read(`components/ui/${name}.tsx`), `${name} should be generated`).toContain("data-slot=");
    }
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--color-poll-best: var(--poll-best)");
    expect(css).toContain("--color-poll-rec: var(--poll-rec)");
    expect(css).toContain("--color-poll-no: var(--poll-no)");
    expect(css).toContain("--color-meter: var(--meter)");
    expect(css).toContain("--font-sans: var(--font-geist-sans)");
    expect(layout).toContain("lang={SITE_LOCALE}");
    expect(layout).toContain("geist/font");
    expect(layout).toContain("TooltipProvider");
  });

  test("keeps only the primitives the interface uses", () => {
    for (const name of ["card", "separator"]) {
      expect(read(`components/ui/${name}.tsx`), `${name} should be removed`).toBe("");
    }
  });

  test("has one colour per shop and no chart primitive", () => {
    const css = read("app/globals.css");
    expect(read("components/ui/chart.tsx")).toBe("");
    for (const shop of ["crowdgames", "lavkaigr", "gaga"]) {
      expect(css).toContain(`--color-shop-${shop}: var(--shop-${shop})`);
    }
  });
});
