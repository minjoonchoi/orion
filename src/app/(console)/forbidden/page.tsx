import { getT } from "@/i18n/server";
import { AccessDenied } from "@/features/auth/access-denied";
export default function Page() {
  return <AccessDenied />;
}

export async function generateMetadata() {
  const t = await getT();
  return {
    title: t("접근 권한이 없습니다"),
    robots: { index: false, follow: false },
  };
}
