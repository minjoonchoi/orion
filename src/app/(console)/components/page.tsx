import type { Metadata } from "next";
import { ComponentExamples } from "@/features/component-examples/component-examples";
export const metadata: Metadata = { title: "컴포넌트" };
export default function ComponentsPage() {
  return <ComponentExamples />;
}
