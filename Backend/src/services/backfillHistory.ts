// Run once before starting the backend: seeds ~30 days of daily closes
// for every ticker in `stocks` (including the ^NSEI benchmark) into
// `daily_prices`. Safe to re-run — upsert on (ticker, trade_date).
//
// Usage: npx tsx src/services/backfillHistory.ts

import { supabaseAdmin } from "./supabase";
import { getHistoricalCloses } from "./marketData";

async function main() {
  const { data: stocks, error } = await supabaseAdmin
    .from("stocks")
    .select("ticker");

  if (error || !stocks) {
    console.error("Failed to load tickers from stocks table:", error?.message);
    process.exit(1);
  }

  for (const item of stocks as { ticker: string }[]) {
    const ticker = item.ticker;
    const { closes, source } = await getHistoricalCloses(ticker, 30);
    console.log(
      `${ticker.padEnd(14)} -> ${closes.length} rows (source: ${source})`,
    );
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error during backfill:", err);
  process.exit(1);
});
