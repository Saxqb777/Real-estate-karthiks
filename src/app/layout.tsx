import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans, Rajdhani } from "next/font/google";
import "./globals.css";

const display = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// the UI lettering (owner 31/10/2026: "copy that design for everything and everywhere" — the reel's plain modern font in
// normal letters; Plus Jakarta Sans looks like it and keeps even-width figures for money columns). Rajdhani stays only
// for the signs painted in the 3D world; Manrope for the printed receipt.
const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

// (no Tamil font: nothing on the site is in Tamil any more — owner, 5/10/2026 — so it is no longer downloaded)

export const metadata: Metadata = {
  title: { default: "Pattukottai Estates", template: "%s · Pattukottai Estates" },
  applicationName: "Pattukottai Estates",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#121317",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
