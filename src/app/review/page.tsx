import { Suspense } from "react";
import { ReviewView } from "./review-view";

export const metadata = { title: "Review · Hindsight" };

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewView />
    </Suspense>
  );
}
