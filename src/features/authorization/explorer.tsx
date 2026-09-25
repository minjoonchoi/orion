"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
export type ExplorerNode = {
  id: string;
  name: string;
  detail?: ReactNode;
  href?: string;
  kind?: string;
  relation?: string;
  children?: ExplorerNode[];
};
export function Explorer({
  nodes,
  initialDepth = 3,
}: {
  nodes: ExplorerNode[];
  initialDepth?: number;
}) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [openDepth, setOpenDepth] = useState(initialDepth);
  function rows(items: ExplorerNode[], parent = "", depth = 0): ReactNode {
    return items.map((node) => {
      const key = `${parent}/${node.id}`;
      const open = depth < openDepth !== collapsed.includes(key);
      return (
        <li key={key} className="explorer-branch">
          <div
            className={`explorer-row explorer-depth-${Math.min(depth, 2)}`}
            data-depth={depth}
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
            <div className="explorer-node-content">
              <div className="explorer-node-title">
                {node.kind && (
                  <span className="explorer-kind">{t(node.kind)}</span>
                )}
                {node.href ? (
                  <Link href={node.href}>{node.name}</Link>
                ) : (
                  <span>{node.name}</span>
                )}
                {!!node.children?.length && (
                  <span className="explorer-count">{node.children.length}</span>
                )}
              </div>
              {(node.relation || node.detail) && (
                <small>
                  {node.relation && (
                    <span className="explorer-relation">
                      {t(node.relation)}
                    </span>
                  )}
                  {node.detail}
                </small>
              )}
            </div>
          </div>
          {open && !!node.children?.length && (
            <ul className="explorer-children">
              {rows(node.children, key, depth + 1)}
            </ul>
          )}
        </li>
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
            setOpenDepth(Infinity);
            setCollapsed([]);
          }}
        >
          {t("모두 펼치기")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenDepth(0);
            setCollapsed([]);
          }}
        >
          {t("모두 접기")}
        </button>
      </div>
      <div className="explorer-list">
        <ul className="explorer-roots" aria-label={t("연결 목록")}>
          {rows(nodes)}
        </ul>
        {!nodes.length && <p>{t("연결된 항목이 없습니다")}</p>}
      </div>
    </div>
  );
}
