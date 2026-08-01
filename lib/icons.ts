import type { IconKey } from "./types";

/**
 * Icon path data, keyed to match tally-backend/constants/icons.js. The API
 * stores only the key; this is where it becomes geometry.
 *
 * All paths are drawn on a 24×24 box for a stroked (fill="none") render, so a
 * single <Icon> component can set stroke, width and linecap uniformly.
 */
export const ICON_PATHS: Record<IconKey, string> = {
  tea: "M6 9h10v6a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9ZM16 10.5h1.4a2.3 2.3 0 0 1 0 4.6H16M9.2 6c0-1 1-1.2 1-2.3M12.8 6c0-1 1-1.2 1-2.3",
  cig: "M3 14.5h13.5v4H3zM18.5 14.5H21v4h-2.5zM17.6 10.6c1.6-.8 2-1.7 2-3.6M14.2 10.6c1.6-.8 2-1.7 2-3.6",
  rick: "M4 17a2.4 2.4 0 1 0 4.8 0A2.4 2.4 0 0 0 4 17M15.2 17a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 0 0-4.8 0M6.8 15V9.2A4.2 4.2 0 0 1 11 5h.6a5 5 0 0 1 5 5V15M6.8 10h9.8",
  lunch: "M3.4 12h17.2a8.6 8.6 0 0 1-17.2 0ZM2 12h20M9.2 8c0-1 1-1.3 1-2.3M13 8c0-1 1-1.3 1-2.3",
  data: "M4 19v-3M9.3 19v-7M14.6 19V8M20 19V4",
  coffee:
    "M6 8.4h12l-1.2 10.8a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8ZM4.6 5h14.8v3.4H4.6zM9.8 2.4v1.4M14.2 2.4v1.4",
  bag: "M6 8h12l-1 12.5H7ZM9 8V6.2A3 3 0 0 1 15 6.2V8",
  bill: "M5 4h14v16l-2.3-1.6L14.4 20 12 18.4 9.6 20l-2.3-1.6L5 20ZM9 9h6M9 13h4",
  grocery: "M4 7h16l-1.4 12.5H5.4ZM8.5 7V5.2A3.5 3.5 0 0 1 15.5 5.2V7M9 11.5v4M15 11.5v4",
  medicine:
    "M10.5 3.5h3v3h3v3h-3v3h-3v-3h-3v-3h3ZM5 15.5h14v5H5Z",
  fuel: "M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12M6 9h6M17 20v-8l2.5-2.5V17a1.5 1.5 0 0 0 1.5 1.5",
  phone: "M7.5 2.5h9v19h-9zM10.5 18.5h3",
  gift: "M3.5 9.5h17v4h-17zM5 13.5h14V21H5ZM12 9.5V21M12 9.5C10 9.5 8 8.6 8 6.8A2.3 2.3 0 0 1 12 5.6a2.3 2.3 0 0 1 4 1.2c0 1.8-2 2.7-4 2.7Z",
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
};

export const DEFAULT_ICON_KEY: IconKey = "bag";

export const iconPath = (key: string | null | undefined): string =>
  ICON_PATHS[(key as IconKey) ?? DEFAULT_ICON_KEY] ?? ICON_PATHS[DEFAULT_ICON_KEY];

/** Navigation and chrome glyphs, kept apart from the expense category icons. */
export const UI_ICONS = {
  home: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  dashboard: "M3 20h18M7 20v-6M12 20V8M17 20v-10",
  habits: "M5 6v12M10 6v12M15 6v12M20 6v12M3 18 22 6",
  profile:
    "M12 11a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2M4.5 20.5c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M20 6 9 17l-5-5",
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 6 6 6-6 6",
  search: "M20 20l-4-4",
  edit: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z",
  trash: "M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 20h9l1-13.5",
  retry: "M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18.5 3v3h-3M5.5 21v-3h3",
  offline:
    "M2 8.5a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.5a5 5 0 0 1 6 0M12 20v.5M3 3l18 18",
  warning: "M12 8v5M12 16.5v.5M12 3 2 20h20Z",
  target: "M12 3.5v17M3.5 12h17",
  // Crescent — the appearance/theme row.
  theme: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5A6.5 6.5 0 0 1 12 3.5Z",
  goal: "M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.5 8.5 0 0 0 12 3.5M12 8.5a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 8.5",
  arrowRight: "M5 12h13M12 5l7 7-7 7",
  camera: "M4 5h16v14H4zM4 15l5-5 5 5 3-3 3 3",
  image: "M4 5h16v14H4zM4 15l5-5 5 5 3-3 3 3",
  logo: "M5 5v14M10 5v14M15 5v14M20 5v14M3 19 22 5",
} as const;

export type UiIconKey = keyof typeof UI_ICONS;
