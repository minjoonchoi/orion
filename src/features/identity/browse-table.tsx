"use client";
import { useI18n } from "@/i18n/provider";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column, type Sort } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export type BrowseFilter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  matches: (row: T, value: string) => boolean;
};
export function BrowseTable<T extends { id: string }>({
  title,
  rows,
  columns,
  searchText,
  sortValue,
  filters = [],
  emptyTitle = "연결된 항목이 없습니다",
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  sortValue: (row: T, key: string) => string | number;
  filters?: BrowseFilter<T>[];
  emptyTitle?: string;
}) {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const prefix = `list.${title}.`;
  const query = params.get(prefix + "q") ?? "";
  const values = Object.fromEntries(
    filters.map((f) => [f.key, params.get(prefix + f.key) ?? ""]),
  );
  const sortKey = params.get(prefix + "sort");
  const sort: Sort =
    sortKey && columns.some((c) => c.key === sortKey && c.sortable)
      ? {
          key: sortKey,
          direction:
            params.get(prefix + "direction") === "desc" ? "desc" : "asc",
        }
      : null;
  const page = Math.max(
    1,
    Math.floor(Number(params.get(prefix + "page")) || 1),
  );
  const requestedSize = Number(params.get(prefix + "size"));
  const size = [5, 10, 20, 50].includes(requestedSize) ? requestedSize : 5;
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(prefix + key, value);
      else next.delete(prefix + key);
    }
    const search = next.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        (search ? `?${search}` : "") +
        window.location.hash,
    );
  }
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = rows.filter(
    (row) =>
      searchText(row).toLocaleLowerCase().includes(normalized) &&
      filters.every(
        (filter) =>
          !values[filter.key] || filter.matches(row, values[filter.key]),
      ),
  );
  const ordered = sort
    ? [...filtered].sort((a, b) => {
        const left = sortValue(a, sort.key);
        const right = sortValue(b, sort.key);
        return (
          (typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), locale)) *
          (sort.direction === "asc" ? 1 : -1)
        );
      })
    : filtered;
  const current = Math.min(page, Math.max(1, Math.ceil(ordered.length / size)));
  const searching = Boolean(normalized || Object.values(values).some(Boolean));
  return (
    <section
      className="ui-panel identity-table"
      aria-label={t(`${title} 조회`)}
    >
      <h2>{t(title)}</h2>
      <TableToolbar
        actions={
          <Button
            variant="ghost"
            onClick={() => {
              update(
                Object.fromEntries(
                  [
                    "q",
                    "sort",
                    "direction",
                    "page",
                    ...filters.map((f) => f.key),
                  ].map((key) => [key, null]),
                ),
              );
            }}
          >
            {t("초기화")}
          </Button>
        }
      >
        <Field label={t(`${title} 검색`)}>
          {(props) => (
            <Input
              {...props}
              type="search"
              placeholder={t("이름 또는 식별자로 검색")}
              value={query}
              onChange={(event) => {
                update({ q: event.target.value, page: null });
              }}
            />
          )}
        </Field>
        {filters.map((filter) => (
          <Field key={filter.key} label={filter.label}>
            {(props) => (
              <Select
                {...props}
                value={values[filter.key] ?? ""}
                onChange={(event) => {
                  update({ [filter.key]: event.target.value, page: null });
                }}
              >
                <option value="">{t("전체")}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ))}
      </TableToolbar>
      <p className="browse-result-count" role="status">
        {t("검색 결과")} {filtered.length} / {rows.length}
      </p>
      <DataTable
        caption={t(title)}
        rows={ordered.slice((current - 1) * size, current * size)}
        columns={columns}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={(next) => {
          update({
            sort: next?.key ?? null,
            direction: next?.direction ?? null,
            page: null,
          });
        }}
        emptyTitle={searching ? t("검색 결과가 없습니다") : emptyTitle}
        emptyDescription={
          searching
            ? t("검색어나 필터를 변경해 주세요.")
            : t("연결된 항목이 있으면 이곳에 표시됩니다.")
        }
      />
      <Pagination
        label={t(`${title} 페이지 이동`)}
        page={current}
        pageSize={size}
        total={ordered.length}
        onPageChange={(next) => update({ page: String(next) })}
        onPageSizeChange={(next) => {
          update({ size: String(next), page: null });
        }}
      />
    </section>
  );
}
export const statusOptions = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
];
