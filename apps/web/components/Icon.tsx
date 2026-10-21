import type { ReactNode } from "react";

export type IconName =
  | "grid" | "plus" | "close" | "back" | "replay" | "grid-plus"
  | "printer" | "bag" | "pin" | "link" | "navigation";

/* Paths copied from the mockups in screens/. 24 viewBox, 1.5 stroke, round caps. */
const PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8" />
      <path d="M4 3v5h5" />
    </>
  ),
  "grid-plus": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <path d="M17 14v7M13.5 17.5h7" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect x="3.5" y="9" width="17" height="7.5" />
      <path d="M7 16.5v4h10v-4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s-7-5.8-7-11.5a7 7 0 0 1 14 0c0 5.7-7 11.5-7 11.5z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </>
  ),
  navigation: <path d="M20 4L4 11l7 2 2 7z" />,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
