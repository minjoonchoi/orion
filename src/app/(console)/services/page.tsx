import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default function Page() {
  return (
    <Suspense>
      <DefinitionsScreen kind="services" />
    </Suspense>
  );
}
