import type { ReactNode } from "react";

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="topbar">
      <span className="wordmark">1/1</span>
      {right ?? <span className="icon-target" />}
    </header>
  );
}
