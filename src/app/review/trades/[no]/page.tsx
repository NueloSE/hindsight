import { TradeView } from "./trade-view";

export const metadata = { title: "Trade · Hindsight" };

export default async function TradePage({ params }: PageProps<"/review/trades/[no]">) {
  const { no } = await params;
  return <TradeView no={Number(no)} />;
}
