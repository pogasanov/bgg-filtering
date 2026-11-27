import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { SITE_LOCALE } from "@/lib/i18n/locale";
import { SHARE_IMAGE, SITE_URL } from "@/lib/seo";

const text = {
  en: { title: "My Next Board Game", subtitle: "The best of BGG for your group size" },
  ru: { title: "Настолки по числу игроков", subtitle: "Лучшее с BGG — под ваш состав" },
}[SITE_LOCALE];

export const alt = SHARE_IMAGE.alt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "node_modules/geist/dist/fonts");

// The poll strip from the results table, for a game that is best at 3, fine at 2 and 4, not for 1 or 5+.
const STRIP = [
  { n: 1, verdict: "no" },
  { n: 2, verdict: "rec" },
  { n: 3, verdict: "best" },
  { n: 4, verdict: "rec" },
  { n: 5, verdict: "no" },
  { n: 6, verdict: "no" },
] as const;

const CELL = {
  best: { background: "#15803d", color: "#ffffff", border: "#15803d" },
  rec: { background: "#86efac", color: "#14532d", border: "#86efac" },
  no: { background: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
} as const;

export default async function OpengraphImage() {
  return new Response(await renderPng(), { headers: { "Content-Type": contentType } });
}

// Cached, so the image is rendered once at build time rather than on every request.
async function renderPng(): Promise<Uint8Array<ArrayBuffer>> {
  "use cache";
  cacheLife("max");
  const [sans, mono] = await Promise.all([
    readFile(join(fontDir, "geist-sans/Geist-SemiBold.ttf")),
    readFile(join(fontDir, "geist-mono/GeistMono-Regular.ttf")),
  ]);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#ffffff",
          color: "#0a0a0a",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {STRIP.map(({ n, verdict }) => (
            <div
              key={n}
              style={{
                width: 64,
                height: 64,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Geist Mono",
                fontSize: 30,
                background: CELL[verdict].background,
                color: CELL[verdict].color,
                border: `3px solid ${CELL[verdict].border}`,
              }}
            >
              {n}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, letterSpacing: -2.5, lineHeight: 1.05 }}>{text.title}</div>
          <div style={{ fontSize: 34, color: "#737373", lineHeight: 1.35 }}>{text.subtitle}</div>
        </div>
        <div style={{ fontFamily: "Geist Mono", fontSize: 26, color: "#a3a3a3" }}>{new URL(SITE_URL).host}</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: sans, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
  return new Uint8Array(await image.arrayBuffer());
}
