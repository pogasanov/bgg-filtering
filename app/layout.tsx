import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BGG Player Finder",
  description: "Filter top BoardGameGeek games by player-count recommendations and game types.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
