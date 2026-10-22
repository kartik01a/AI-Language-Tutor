import type { Metadata, Viewport } from "next";
import { Baloo_2, M_PLUS_Rounded_1c, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["700"] });
// CJK fonts are served as unicode-range slices, so only the glyphs actually used are downloaded.
const jpRounded = M_PLUS_Rounded_1c({ variable: "--font-jp-rounded", weight: ["500", "700"], preload: false });

export const metadata: Metadata = {
  title: "Lactice",
  description: "Speak Japanese, German and English with a friendly tutor.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf8f5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${baloo.variable} ${jpRounded.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
