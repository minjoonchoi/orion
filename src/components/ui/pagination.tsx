"use client";
import { useId } from "react";
import { Button } from "./button";
import { Select } from "./input";
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  label = "목록 페이지",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="ui-pagination" aria-label={label}>
      <div className="ui-actions">
        <label htmlFor={id}>페이지당</label>
        <Select
          id={id}
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {[5, 10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size}개
            </option>
          ))}
        </Select>
        <span aria-live="polite">총 {total}개</span>
      </div>
      <div className="ui-actions">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전
        </Button>
        <span>
          {page} / {pages} 페이지
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          다음
        </Button>
      </div>
    </nav>
  );
}
