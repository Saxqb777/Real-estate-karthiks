import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Tamil, Rajdhani } from "next/font/google";
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

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["500", "600"],
  variable: "--font-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pattukottai Estates", template: "%s · Pattukottai Estates" },
  applicationName: "Pattukottai Estates",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#151310",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${tamil.variable}`}>
      <body>{children}</body>
    </html>
  );
}
