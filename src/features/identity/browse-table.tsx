"use client";
import { useI18n } from "@/i18n/provider";
import { useState } from "react";
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
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
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
              setQuery("");
              setValues({});
              setSort(null);
              setPage(1);
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
                setQuery(event.target.value);
                setPage(1);
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
                  setValues({ ...values, [filter.key]: event.target.value });
                  setPage(1);
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
      <DataTable
        caption={t(title)}
        rows={ordered.slice((current - 1) * size, current * size)}
        columns={columns}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
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
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setSize(next);
          setPage(1);
        }}
      />
    </section>
  );
}
export const statusOptions = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
];
