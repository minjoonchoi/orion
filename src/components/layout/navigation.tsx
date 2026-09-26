"use client";
import { useI18n } from "@/i18n/provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navigationGroups, isNavigationActive } from "@/config/navigation";
export function Navigation() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const expanded = expandedPath === pathname;
  return (
    <>
      <button
        className="mobile-navigation-toggle"
        aria-expanded={expanded}
        aria-controls="primary-navigation"
        onClick={() => setExpandedPath(expanded ? null : pathname)}
      >
        {t(expanded ? "메뉴 닫기" : "메뉴 열기")}
      </button>
      <nav
        id="primary-navigation"
        data-expanded={expanded}
        aria-label={t("주 메뉴")}
      >
        {navigationGroups.map((group) => (
          <section
            className="navigation-group"
            key={group.id}
            aria-labelledby={`nav-${group.id}`}
          >
            <h2 id={`nav-${group.id}`} className="navigation-group-title">
              {t(group.label)}
            </h2>
            <ul className="navigation-items">
              {group.items.map((item) => (
                <li
                  key={item.href}
                  className={
                    item.href === "/policies" || item.href === "/resources"
                      ? "navigation-divider"
                      : undefined
                  }
                >
                  <Link
                    href={item.href}
                    onClick={() => setExpandedPath(null)}
                    aria-current={
                      isNavigationActive(pathname, item.href)
                        ? "page"
                        : undefined
                    }
                  >
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </>
  );
}
