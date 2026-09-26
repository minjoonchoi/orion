"use client";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
export function IssueKeyDialog({
  account,
}: {
  account: { id: string; name: string; status: string };
  services: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  return account.status === "active" ? (
    <Link
      className="ui-button ui-button--primary ui-button--md"
      href={`/approvals/new?account=${encodeURIComponent(account.id)}`}
    >
      {t("발급 요청")}
    </Link>
  ) : null;
}
