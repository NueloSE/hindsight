import { DemoBanner } from "@/components/demo-banner";
import { CoachView } from "./coach-view";

export const metadata = { title: "Ask the coach · Hindsight" };

export default function CoachPage() {
  return (
    <>
      <DemoBanner />
      <CoachView />
    </>
  );
}
