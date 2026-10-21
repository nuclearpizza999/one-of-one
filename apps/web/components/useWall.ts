"use client";

import { useEffect, useState } from "react";

/** The wall behind the card follows the system theme; the card itself never changes. */
export function useWall(): "light" | "dark" {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return dark ? "dark" : "light";
}
