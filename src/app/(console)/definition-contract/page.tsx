import { Suspense } from "react";
import { ContractScreen } from "@/features/definition-contract/screen";
export default function Page() {
  return (
    <Suspense>
      <ContractScreen />
    </Suspense>
  );
}
