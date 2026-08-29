import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { EVENT } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter",
                      weight: ["300","400","500","700","800","900"] });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair",
                                    weight: ["500","700","900"], style: ["normal","italic"] });

export const metadata: Metadata = {
  title: `${EVENT.name} — ${EVENT.venue}`,
  description: `${EVENT.subtitle} · ${EVENT.date} · ${EVENT.venue}`,
};
export const viewport: Viewport = {
  themeColor: "#090b10", width: "device-width", initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
