"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { State } from "./model";
export function EndpointPicker({
  rows,
  selected,
  onChange,
  disabled = false,
}: {
  rows: State["endpoints"];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const text = (ko: string, en: string) => (locale === "en" ? en : ko);
  const [query, setQuery] = useState(""),
    [onlySelected, setOnlySelected] = useState(false),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5);
  const filtered = rows.filter(
    (e) =>
      (!onlySelected || selected.includes(e.id)) &&
      `${e.name} ${e.method} ${e.path} ${e.id}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / size)),
  );
  return (
    <section
      className="wf-endpoint-picker"
      aria-label={text("엔드포인트 선택", "Endpoint selection")}
    >
      <div className="wf-endpoint-toolbar">
        <Field label={text("엔드포인트 검색", "Search endpoints")}>
          {(props) => (
            <Input
              {...props}
              type="search"
              value={query}
              placeholder={text(
                "이름, 경로, HTTP 메서드",
                "Name, path, HTTP method",
              )}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Button
          variant="secondary"
          aria-pressed={onlySelected}
          onClick={() => {
            setOnlySelected(!onlySelected);
            setPage(1);
          }}
        >
          {text("선택만 보기", "Selected only")} ({selected.length})
        </Button>
      </div>
      <p role="status">
        {text("선택한 엔드포인트", "Selected endpoints")} {selected.length} ·{" "}
        {text("검색 결과", "Results")} {filtered.length}
      </p>
      <DataTable
        caption={text("접근할 엔드포인트", "Endpoints to allow")}
        rows={filtered.slice((current - 1) * size, current * size)}
        getRowId={(e) => e.id}
        emptyTitle={
          rows.length
            ? text("검색 결과가 없습니다", "No results")
            : text("엔드포인트가 없습니다", "No endpoints")
        }
        emptyDescription={
          rows.length
            ? text(
                "검색어나 선택 필터를 변경하세요.",
                "Change the search or selection filter.",
              )
            : text(
                "관리 서비스를 선택하면 엔드포인트가 표시됩니다.",
                "Select a managed service to view endpoints.",
              )
        }
        columns={[
          {
            key: "selected",
            header: text("선택", "Select"),
            render: (e) => (
              <input
                type="checkbox"
                aria-label={`${e.method} ${e.path} ${e.name}`}
                disabled={disabled}
                checked={selected.includes(e.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, e.id]
                      : selected.filter((id) => id !== e.id),
                  )
                }
              />
            ),
          },
          {
            key: "endpoint",
            header: text("엔드포인트", "Endpoint"),
            render: (e) => (
              <>
                <code>
                  {e.method} {e.path}
                </code>
                <div>{e.name}</div>
              </>
            ),
          },
        ]}
      />
      <Pagination
        label={text("엔드포인트 페이지 이동", "Endpoint pagination")}
        page={current}
        pageSize={size}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setSize(value);
          setPage(1);
        }}
      />
    </section>
  );
}
