import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4 } from "next/font/google";
import Script from "next/script";

import { AppSplash } from "@/app/_components/app-splash";
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const serifFont = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "Place Print Journey",
  description: "Theme gallery, details flow, generation, and result pages for map posters."
};

const themeInitializer = `(() => {
  const storageKey = "placeprint-theme-preference";
  try {
    const stored = window.localStorage.getItem(storageKey);
    const root = document.documentElement;
    if (stored === "light" || stored === "dark") {
      root.setAttribute("data-theme", stored);
      root.setAttribute("data-theme-preference", stored);
      return;
    }
    root.removeAttribute("data-theme");
    root.setAttribute("data-theme-preference", "system");
  } catch {
    document.documentElement.setAttribute("data-theme-preference", "system");
  }
})();`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${serifFont.variable}`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitializer}
        </Script>
        <AppSplash />
        {children}
      </body>
    </html>
  );
}
