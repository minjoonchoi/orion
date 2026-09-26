import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import { ComponentExamples } from "@/features/component-examples/component-examples";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("컴포넌트") };
}
export default function ComponentsPage() {
  return <ComponentExamples />;
}
