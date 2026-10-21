import type { ReactNode } from "react";
import { TabBar } from "./TabBar";

export function AppFrame({ top, children }: { top: ReactNode; children: ReactNode }) {
  return (
    <div className="app">
      {top}
      <main className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}
