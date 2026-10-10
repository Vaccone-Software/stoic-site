import type { Metadata } from "next";
import {
  EB_Garamond,
  Geist_Mono,
  IM_Fell_English,
  League_Gothic,
} from "next/font/google";
import "./globals.css";

const leagueGothic = League_Gothic({
  variable: "--font-league-gothic",
  subsets: ["latin"],
});
const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});
const imFell = IM_Fell_English({
  variable: "--font-im-fell",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vaccone-software.github.io/stoic-site/"),
  title: {
    default: "Stoic: reliable async code for Swift",
    template: "%s · Stoic",
  },
  description:
    "A Swift library for async code that has to keep working: timeouts that cancel, retries with budgets, cleanup that always runs, supervision, validated data, and deterministic tests.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${leagueGothic.variable} ${ebGaramond.variable} ${imFell.variable} ${geistMono.variable}`}
    >
      <body className="min-h-svh bg-ground text-print">{children}</body>
    </html>
  );
}
