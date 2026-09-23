"use client";
import type { ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { EmptyState } from "./empty-state";
import { Alert } from "./alert";
import { Skeleton } from "./skeleton";
import { Button } from "./button";
export type Sort = { key: string; direction: "asc" | "desc" } | null;
export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
};
export type TableSelection<T> = {
  ids: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
  label: (row: T) => string;
  canSelect?: (row: T) => boolean;
};
/** Controlled table: callers own filtering, sorting, paging, and selection across pages. */
export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  sort,
  onSortChange,
  selection,
  loading,
  error,
  onRetry,
  emptyTitle = "검색 결과가 없습니다",
  emptyDescription = "검색어나 필터를 변경해 주세요.",
}: {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  selection?: TableSelection<T>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) return <Skeleton label={`${caption} 불러오는 중`} />;
  if (error)
    return (
      <Alert
        tone="danger"
        title={error}
        action={
          onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              다시 시도
            </Button>
          )
        }
      />
    );
  if (!rows.length)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const selectable = rows
    .filter(
      (row) => selection && (!selection.canSelect || selection.canSelect(row)),
    )
    .map(getRowId);
  const selectedCount = selectable.filter((id) =>
    selection?.ids.has(id),
  ).length;
  function togglePage(checked: boolean) {
    if (!selection) return;
    const next = new Set(selection.ids);
    selectable.forEach((id) => {
      if (checked) next.add(id);
      else next.delete(id);
    });
    selection.onChange(next);
  }
  return (
    <div
      className="ui-table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="ui-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="ui-selection-cell">
                <Checkbox
                  aria-label="현재 페이지 전체 선택"
                  checked={
                    selectable.length > 0 && selectedCount === selectable.length
                  }
                  indeterminate={
                    selectedCount > 0 && selectedCount < selectable.length
                  }
                  disabled={selectable.length === 0}
                  onChange={(e) => togglePage(e.target.checked)}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={
                  column.sortable && onSortChange
                    ? sort?.key === column.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                }
              >
                {column.sortable && onSortChange ? (
                  <button
                    className="ui-sort-button"
                    onClick={() =>
                      onSortChange(
                        sort?.key !== column.key
                          ? { key: column.key, direction: "asc" }
                          : sort.direction === "asc"
                            ? { key: column.key, direction: "desc" }
                            : null,
                      )
                    }
                  >
                    {column.header}
                    <span aria-hidden="true">
                      {sort?.key === column.key
                        ? sort.direction === "asc"
                          ? " ↑"
                          : " ↓"
                        : " ↕"}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            return (
              <tr key={id} data-selected={selection?.ids.has(id) || undefined}>
                {selection && (
                  <td className="ui-selection-cell">
                    <Checkbox
                      aria-label={`${selection.label(row)} 선택`}
                      checked={selection.ids.has(id)}
                      disabled={
                        selection.canSelect ? !selection.canSelect(row) : false
                      }
                      onChange={(e) => {
                        const next = new Set(selection.ids);
                        if (e.target.checked) next.add(id);
                        else next.delete(id);
                        selection.onChange(next);
                      }}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
