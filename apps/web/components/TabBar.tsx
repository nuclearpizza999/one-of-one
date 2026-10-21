"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export function TabBar() {
  const path = usePathname();
  const tab = (href: string, label: string, icon: IconName) => (
    <Link
      href={href}
      aria-label={label}
      className="tab"
      aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}
    >
      <Icon name={icon} />
    </Link>
  );
  return (
    <nav className="tabbar" aria-label="Tabs">
      {tab("/board", "Board", "grid")}
      <div className="tab" aria-hidden="true" />
      {tab("/make", "Make", "plus")}
    </nav>
  );
}
