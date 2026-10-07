import { DemoBanner } from "@/components/demo-banner";
import { Suspense } from "react";
import { CheckView } from "./check-view";

export const metadata = { title: "Check a trade · Hindsight" };

export default function CheckPage() {
  return (
    <>
      <DemoBanner />
      <Suspense>
        <CheckView />
      </Suspense>
    </>
  );
}
