import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const SITE_NAME = "Настолки по числу игроков";
const DESCRIPTION =
  "Лучшие настолки с BoardGameGeek под ваш состав: на двоих, на троих, на шестерых — по голосам игроков. Фильтры по механикам и цены в магазинах.";

// og:image and twitter:image come from app/opengraph-image.tsx; the favicon from app/icon.svg.
export const metadata: Metadata = {
  metadataBase: new URL("https://bg.gsnv.dev"),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
    locale: "ru_RU",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: DESCRIPTION },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
