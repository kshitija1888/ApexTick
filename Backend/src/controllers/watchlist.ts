import { Request, Response } from "express";
import { supabaseAdmin } from "../services/supabase";
import {
  getLiveQuote,
  getCachedHistory,
  getPriceAtOrBefore,
  fetchLiveQuoteStrict,
  getHistoricalCloses,
} from "../services/marketData";
import { evaluateSignificance } from "../services/Significanceengine";

const INDEX_TICKER = "^NSEI";

export async function getWatchlist(req: Request, res: Response) {
  const userId = req.userId!;

  const { data: rows, error } = await supabaseAdmin
    .from("watchlists")
    .select("ticker, added_price, created_at, stocks(name, sector, is_index)")
    .eq("user_id", userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Read-only: does NOT update last_visited_at. Heartbeat owns that write,
  // called once per session. This just reads whatever the current session's
  // start time is — the boundary "since you left" diffs are measured from.
  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("last_visited_at")
    .eq("user_id", userId)
    .maybeSingle();
  const previousVisitAt: string | null = session?.last_visited_at ?? null;

  // Shared across every stock in this response — one index quote/history
  // fetch, not one per watchlist entry.
  const indexQuote = await getLiveQuote(INDEX_TICKER);
  const { closes: indexCloses } = await getCachedHistory(INDEX_TICKER, 30);

  const enriched = await Promise.all(
    (rows ?? []).map(async (row: any) => {
      const [quote, historyResult, priceAtLastVisit] = await Promise.all([
        getLiveQuote(row.ticker),
        getCachedHistory(row.ticker, 30),
        previousVisitAt
          ? getPriceAtOrBeforeSafe(row.ticker, previousVisitAt)
          : Promise.resolve(null),
      ]);

      const addedPrice = Number(row.added_price);
      const changeSinceAddedPct =
        addedPrice > 0
          ? Math.round(((quote.price - addedPrice) / addedPrice) * 10000) / 100
          : null;

      const significance = evaluateSignificance({
        ticker: row.ticker,
        currentPrice: quote.price,
        historicalCloses: historyResult.closes,
        indexCloses,
        indexCurrentPrice: indexQuote.price,
        previousVisitAt,
        priceAtLastVisit,
      });

      const newBadges = await markNewBadges(
        userId,
        row.ticker,
        significance.badges,
      );

      return {
        ticker: row.ticker,
        name: row.stocks?.name ?? row.ticker,
        sector: row.stocks?.sector ?? null,
        addedPrice,
        currentPrice: quote.price,
        changeSinceAddedPct,
        dataSource: quote.source,
        asOf: quote.asOf,
        significance: { ...significance, newBadges },
      };
    }),
  );

  enriched.sort(
    (a, b) => b.significance.attentionScore - a.significance.attentionScore,
  );

  res.json({ watchlist: enriched, previousVisitAt });
}

// Degrades to null (no since-visit diff) instead of taking the whole
// request down if this particular lookup fails.
async function getPriceAtOrBeforeSafe(
  ticker: string,
  timestamp: string,
): Promise<number | null> {
  try {
    return await getPriceAtOrBefore(ticker, timestamp);
  } catch {
    return null;
  }
}

// Records which badges are being shown to this user for the first time
// TODAY (per ticker+event_type+date, via the unique constraint on
// flagged_events). Badges keep showing every call as long as they're true —
// this doesn't hide anything — but the frontend can use `newBadges` to
// highlight what's actually new instead of re-announcing the same signal
// every single refresh.
async function markNewBadges(
  userId: string,
  ticker: string,
  badges: string[],
): Promise<string[]> {
  if (badges.length === 0) return [];
  const eventDate = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    badges.map(async (eventType) => {
      const { data, error } = await supabaseAdmin
        .from("flagged_events")
        .upsert(
          {
            user_id: userId,
            ticker,
            event_type: eventType,
            event_date: eventDate,
          },
          {
            onConflict: "user_id,ticker,event_type,event_date",
            ignoreDuplicates: true,
          },
        )
        .select();
      if (error) {
        console.warn(
          `[flaggedEvents] upsert failed for ${ticker}/${eventType}:`,
          error.message,
        );
        return null; // fail closed — don't claim "new" if we're not sure
      }
      // ignoreDuplicates means a conflict returns no row — only a genuine
      // first-insert-today comes back with data
      return data && data.length > 0 ? eventType : null;
    }),
  );

  return results.filter((b): b is string => b !== null);
}

export async function addToWatchlist(req: Request, res: Response) {
  const userId = req.userId!;
  const { ticker } = req.body as { ticker?: string };

  if (!ticker) {
    return res.status(400).json({ error: "ticker is required" });
  }

  const { data: stock, error: stockError } = await supabaseAdmin
    .from("stocks")
    .select("ticker")
    .eq("ticker", ticker)
    .maybeSingle();

  if (stockError) {
    return res.status(500).json({ error: stockError.message });
  }

  if (!stock) {
    // Scoped to Indian exchanges only — this is an NSE/BSE watchlist, not a
    // global one. Accepting e.g. a bare US ticker would silently break the
    // ₹-denominated UI and everything downstream that assumes INR.
    if (!ticker.endsWith(".NS") && !ticker.endsWith(".BO")) {
      return res.status(400).json({
        error: `${ticker} isn't an NSE/BSE ticker — this watchlist only supports Indian exchanges (.NS or .BO)`,
      });
    }

    // Deliberately does NOT use getLiveQuote here, since that function's
    // fallback chain would silently synthesize a plausible-looking price
    // for a ticker that doesn't exist at all — this is the one place we
    // need a hard yes/no.
    const liveCheck = await fetchLiveQuoteStrict(ticker);
    if (!liveCheck) {
      return res.status(404).json({ error: `Unknown ticker: ${ticker}` });
    }

    const { error: registerError } = await supabaseAdmin.from("stocks").upsert({
      ticker,
      name: liveCheck.name,
      exchange: ticker.endsWith(".NS") ? "NSE" : "BSE",
      is_index: false,
    });
    if (registerError) {
      console.warn(
        `[watchlist] failed to auto-register ${ticker}:`,
        registerError.message,
      );
    }

    // Backfill real daily_prices NOW, not later — otherwise the first
    // GET /watchlist call finds <5 history rows and falls back to a random
    // synthetic series that has no relationship to the real price we just
    // fetched, producing significance numbers that look real but aren't.
    const { source: historySource } = await getHistoricalCloses(ticker, 30);
    if (historySource !== "live") {
      console.warn(
        `[watchlist] auto-registered ${ticker} but history backfill fell back to ${historySource} — significance scores for this stock may be unreliable until real history exists`,
      );
    }
  }

  const quote = await getLiveQuote(ticker);

  const { data, error } = await supabaseAdmin
    .from("watchlists")
    .insert({ user_id: userId, ticker, added_price: quote.price })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: `${ticker} is already in your watchlist` });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({
    watchlistEntry: data,
    addedAtPrice: quote.price,
    dataSource: quote.source,
  });
}

export async function removeFromWatchlist(req: Request, res: Response) {
  const userId = req.userId!;
  const { ticker } = req.params;

  const { error, count } = await supabaseAdmin
    .from("watchlists")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("ticker", ticker);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!count) {
    return res
      .status(404)
      .json({ error: `${ticker} not found in your watchlist` });
  }

  res.status(204).send();
}

// Per-stock detail: full 30-day price arrays for the stock and the benchmark
// (needed for the chart's ±1σ band and the overlay), the current live prices
// for both, and a fresh significance calculation. Ownership-checked — a user
// can only pull detail for a ticker actually in their watchlist.
export async function getStockDetail(req: Request, res: Response) {
  const userId = req.userId!;
  const rawTicker = req.params.ticker;
  const ticker = Array.isArray(rawTicker) ? rawTicker[0] : rawTicker;
  if (!ticker) {
    return res.status(400).json({ error: "ticker is required" });
  }

  const { data: entry, error: ownershipError } = await supabaseAdmin
    .from("watchlists")
    .select("ticker, added_price, created_at, stocks(name, sector)")
    .eq("user_id", userId)
    .eq("ticker", ticker)
    .maybeSingle();

  if (ownershipError) {
    return res.status(500).json({ error: ownershipError.message });
  }
  if (!entry) {
    return res
      .status(404)
      .json({ error: `${ticker} not found in your watchlist` });
  }

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("last_visited_at")
    .eq("user_id", userId)
    .maybeSingle();
  const previousVisitAt: string | null = session?.last_visited_at ?? null;

  const [stockQuote, indexQuote, stockHistory, indexHistory, priceAtLastVisit] =
    await Promise.all([
      getLiveQuote(ticker),
      getLiveQuote(INDEX_TICKER),
      getCachedHistory(ticker, 30),
      getCachedHistory(INDEX_TICKER, 30),
      previousVisitAt
        ? getPriceAtOrBeforeSafe(ticker, previousVisitAt)
        : Promise.resolve(null),
    ]);

  const significance = evaluateSignificance({
    ticker,
    currentPrice: stockQuote.price,
    historicalCloses: stockHistory.closes,
    indexCloses: indexHistory.closes,
    indexCurrentPrice: indexQuote.price,
    previousVisitAt,
    priceAtLastVisit,
  });

  // deliberately does NOT call markNewBadges — this endpoint is a read/drill-in,
  // not a fresh-attention event; leaving badge dedup owned by GET /watchlist
  const entryStocks = entry.stocks as unknown as {
    name?: string;
    sector?: string | null;
  } | null;

  res.json({
    ticker,
    name: entryStocks?.name ?? ticker,
    sector: entryStocks?.sector ?? null,
    addedPrice: Number(entry.added_price),
    currentPrice: stockQuote.price,
    dataSource: stockQuote.source,
    asOf: stockQuote.asOf,
    history: stockHistory.closes,
    historySource: stockHistory.source,
    index: {
      ticker: INDEX_TICKER,
      currentPrice: indexQuote.price,
      history: indexHistory.closes,
    },
    priceAtLastVisit,
    previousVisitAt,
    significance,
  });
}
