"use client";
import { useI18n } from "@/i18n/provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationGroups, isNavigationActive } from "@/config/navigation";
export function Navigation() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label={t("주 메뉴")}>
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
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={
                    isNavigationActive(pathname, item.href) ? "page" : undefined
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
  );
}
