import { DemoBanner } from "@/components/demo-banner";
import { Suspense } from "react";
import { ReviewView } from "./review-view";

export const metadata = { title: "Review · Hindsight" };

export default function ReviewPage() {
  return (
    <>
      <DemoBanner />
      <Suspense>
        <ReviewView />
      </Suspense>
    </>
  );
}
