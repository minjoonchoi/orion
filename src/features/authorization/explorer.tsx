"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
export type ExplorerNode = {
  id: string;
  name: string;
  detail?: ReactNode;
  href?: string;
  children?: ExplorerNode[];
};
export function Explorer({ nodes }: { nodes: ExplorerNode[] }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [all, setAll] = useState(true);
  function rows(items: ExplorerNode[], parent = "", depth = 0): ReactNode {
    return items.map((node) => {
      const key = `${parent}/${node.id}`;
      const open = all !== collapsed.includes(key);
      return (
        <div key={key}>
          <div
            className={`explorer-row explorer-depth-${Math.min(depth, 2)}`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {node.children?.length ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${node.name} ${t("하위 항목")}`}
                onClick={() =>
                  setCollapsed(
                    collapsed.includes(key)
                      ? collapsed.filter((v) => v !== key)
                      : [...collapsed, key],
                  )
                }
              >
                {open ? "▾" : "▸"}
              </button>
            ) : (
              <span className="explorer-spacer" />
            )}
            {node.href ? (
              <Link href={node.href}>{node.name}</Link>
            ) : (
              <span>{node.name}</span>
            )}
            {!!node.children?.length && (
              <span className="explorer-count">{node.children.length}</span>
            )}
            <small>{node.detail}</small>
          </div>
          {open && rows(node.children ?? [], key, depth + 1)}
        </div>
      );
    });
  }
  return (
    <div className="access-explorer">
      <div className="explorer-toolbar">
        <strong>{t("연결 목록")}</strong>
        <button
          type="button"
          onClick={() => {
            setAll(true);
            setCollapsed([]);
          }}
        >
          {t("모두 펼치기")}
        </button>
        <button
          type="button"
          onClick={() => {
            setAll(false);
            setCollapsed([]);
          }}
        >
          {t("모두 접기")}
        </button>
      </div>
      <div className="explorer-list">
        {rows(nodes)}
        {!nodes.length && <p>{t("연결된 항목이 없습니다")}</p>}
      </div>
    </div>
  );
}
