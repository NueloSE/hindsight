import { DemoBanner } from "@/components/demo-banner";
import { TradeView } from "./trade-view";

export const metadata = { title: "Trade · Hindsight" };

export default async function TradePage({ params }: PageProps<"/review/trades/[no]">) {
  const { no } = await params;
  return (
    <>
      <DemoBanner />
      <TradeView no={Number(no)} />
    </>
  );
}
