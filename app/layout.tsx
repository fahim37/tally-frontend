import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/shell/Providers";
import "./globals.css";

// The design's three faces. Self-hosted by next/font, so there is no
// render-blocking request to Google and no layout shift on first paint.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tally",
    template: "%s · Tally",
  },
  description:
    "One tap logs it. A personal expense tracker built around a single gesture.",
  applicationName: "Tally",
  appleWebApp: {
    capable: true,
    title: "Tally",
    // Status bar sits over the app's own background, not a black bar.
    statusBarStyle: "default",
  },
  formatDetection: {
    // Stop iOS turning logged amounts into phone-number links.
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The Tap Pad is a precision target and pinch-zoom drifting it under the
  // thumb works against that — but zoom stays reachable rather than locked,
  // so this caps rather than disables it.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
