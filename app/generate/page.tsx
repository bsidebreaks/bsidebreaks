import { Suspense } from "react";
import GeneratePageClient from "./GeneratePageClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GeneratePageClient />
    </Suspense>
  );
}
