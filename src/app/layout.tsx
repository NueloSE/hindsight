import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { DatasetProvider } from "@/components/dataset";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://hindsight-puce.vercel.app"),
  title: "Hindsight: your trades, reviewed",
  description:
    "AI post-trade review for 24/7 tokenized US stock traders on Bitget. Finds the habits that cost you money, proves them with your own trades, and turns them into rules.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <DatasetProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-rule">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between">
              <p>Hindsight reviews your past trades. It never places orders and is not financial advice.</p>
              <p>Market data: Bitget (rTokens), Yahoo Finance, Nasdaq earnings calendar.</p>
            </div>
          </footer>
        </DatasetProvider>
      </body>
    </html>
  );
}
