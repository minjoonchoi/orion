import Link from "next/link";
export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="현재 위치" className="ui-breadcrumbs">
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
