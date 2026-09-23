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
  const [mode, setMode] = useState("columns");
  const [path, setPath] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const columns: ExplorerNode[][] = [nodes];
  const selected: ExplorerNode[] = [];
  for (const id of path) {
    const node = columns[columns.length - 1].find((n) => n.id === id);
    if (!node) break;
    selected.push(node);
    if (node.children?.length) columns.push(node.children);
    else break;
  }
  const active = selected.at(-1);
  function rows(items: ExplorerNode[], parent = "", depth = 0): ReactNode {
    return items.map((node) => {
      const key = `${parent}/${node.id}`;
      const open = expanded.includes(key);
      return (
        <div key={key}>
          <div
            className="explorer-row"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            {node.children?.length ? (
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${node.name} ${t("하위 항목")}`}
                onClick={() =>
                  setExpanded(
                    open
                      ? expanded.filter((v) => v !== key)
                      : [...expanded, key],
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
            <small>{node.detail}</small>
          </div>
          {open && rows(node.children ?? [], key, depth + 1)}
        </div>
      );
    });
  }
  return (
    <div className="access-explorer">
      <div
        className="explorer-toolbar"
        role="group"
        aria-label={t("탐색 보기")}
      >
        <button
          type="button"
          aria-pressed={mode === "columns"}
          onClick={() => setMode("columns")}
        >
          {t("계층 보기")}
        </button>
        <button
          type="button"
          aria-pressed={mode === "list"}
          onClick={() => setMode("list")}
        >
          {t("목록 보기")}
        </button>
      </div>
      {mode === "columns" ? (
        <>
          <nav className="explorer-breadcrumb" aria-label={t("탐색 경로")}>
            <button type="button" onClick={() => setPath([])}>
              {t("전체")}
            </button>
            {selected.map((node, i) => (
              <button
                type="button"
                key={node.id}
                onClick={() => setPath(path.slice(0, i + 1))}
              >
                {" "}
                / {node.name}
              </button>
            ))}
          </nav>
          <div className="explorer-columns">
            {columns.map((items, depth) => (
              <div
                className="explorer-column"
                key={depth}
                aria-label={`${t("단계")} ${depth + 1}`}
              >
                {items.map((node) => (
                  <button
                    type="button"
                    key={node.id}
                    aria-pressed={selected[depth]?.id === node.id}
                    onClick={(e) => {
                      setPath([...path.slice(0, depth), node.id]);
                      const column = e.currentTarget.parentElement;
                      requestAnimationFrame(() =>
                        column?.nextElementSibling?.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        }),
                      );
                    }}
                  >
                    <span>{node.name}</span>
                    <small>{node.detail}</small>
                    {!!node.children?.length && (
                      <span className="explorer-next">
                        › {node.children.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {!nodes.length && <p>{t("연결된 항목이 없습니다")}</p>}
          </div>
          <div className="explorer-selection">
            {active ? (
              <>
                {active.name} · {active.detail}{" "}
                {active.href && (
                  <Link href={active.href}>{t("상세 보기")}</Link>
                )}
              </>
            ) : (
              t("항목을 선택하여 다음 단계로 탐색하세요")
            )}
          </div>
        </>
      ) : (
        <div className="explorer-list">
          {rows(nodes)}
          {!nodes.length && <p>{t("연결된 항목이 없습니다")}</p>}
        </div>
      )}
    </div>
  );
}
