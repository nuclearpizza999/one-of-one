import type { ReactNode } from "react";

export function StatusLine({ children }: { children?: ReactNode }) {
  return (
    <p className="status" role="status" aria-live="polite">
      {children}
    </p>
  );
}
