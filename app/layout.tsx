import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { LocaleProvider } from "@/components/locale";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

/**
 * Ownership proofs for the search engines' webmaster tools, from the build environment. Each one
 * is a public meta tag; unset ones are left out.
 */
function verification(): Metadata["verification"] {
  const bing = process.env.BING_SITE_VERIFICATION;
  return {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.YANDEX_VERIFICATION || undefined,
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

// og:image and twitter:image come from app/opengraph-image.tsx; the favicon from app/icon.svg.
// Every list page sets its own title, description and canonical address (lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "ru_RU",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  verification: verification(),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <LocaleProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
