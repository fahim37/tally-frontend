import type { MetadataRoute } from "next";

/**
 * PWA manifest. `display: standalone` is what makes an installed Tally open
 * without browser chrome — the Tap Pad is meant to be a home-screen icon you
 * hit and log from, not a tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tally — one tap logs it",
    short_name: "Tally",
    description:
      "One tap logs it. A personal expense tracker built around a single gesture.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#1b4dff",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Maskable so Android can crop to its own shape without clipping the mark.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Log an expense",
        short_name: "Log",
        description: "Open the Tap Pad",
        url: "/?action=log",
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Today, this month, and where it went",
        url: "/dashboard",
      },
    ],
  };
}
