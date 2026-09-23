"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴">
      {navigation.map(({ href, label }) => {
        const active =
          href === "/"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
