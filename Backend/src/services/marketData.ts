import YahooFinance from "yahoo-finance2";
import { supabaseAdmin } from "./supabase";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type DataSource = "live" | "cached" | "demo";

export interface LiveQuote {
  ticker: string;
  price: number;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  source: DataSource;
  asOf: string;
}

export interface DailyClose {
  tradeDate: string;
  closePrice: number;
}

const SYNTHETIC_SEEDS: Record<string, number> = {
  "RELIANCE.NS": 1320,
  "TCS.NS": 2300,
  "INFY.NS": 1130,
  "HDFCBANK.NS": 710,
  "TMPV.NS": 310,
  "^NSEI": 23900,
};

function syntheticBasePrice(ticker: string): number {
  return SYNTHETIC_SEEDS[ticker] ?? 500;
}

// How long a cached snapshot counts as "fresh enough" to skip a live call.
// This is what makes the design scale: N users watching the same ticker
// within this window share one row instead of triggering N Yahoo calls.
const CACHE_FRESHNESS_SECONDS = 45;

async function tryFreshCache(ticker: string): Promise<LiveQuote | null> {
  const { data, error } = await supabaseAdmin
    .from("latest_snapshots")
    .select("*")
    .eq("ticker", ticker)
    .maybeSingle();

  if (error || !data) return null;

  const ageSeconds = (Date.now() - new Date(data.recorded_at).getTime()) / 1000;
  if (ageSeconds > CACHE_FRESHNESS_SECONDS) return null;

  return {
    ticker,
    price: Number(data.price),
    dayHigh: data.day_high !== null ? Number(data.day_high) : null,
    dayLow: data.day_low !== null ? Number(data.day_low) : null,
    week52High: data.week_52_high !== null ? Number(data.week_52_high) : null,
    week52Low: data.week_52_low !== null ? Number(data.week_52_low) : null,
    volume: data.volume ? Number(data.volume) : null,
    // preserves whatever the cached row's origin actually was (live/demo) —
    // a fresh cache hit isn't a new source, it's a recent copy of the old one
    source: data.source as DataSource,
    asOf: data.recorded_at,
  };
}

// Deliberately does NOT fall back to cache/synthetic — used only to
// validate a ticker that isn't in `stocks` yet. If this fails, the ticker
// is genuinely unknown/invalid, not just temporarily unreachable (a known
// ticker with a Yahoo outage still goes through getLiveQuote's normal
// fallback chain instead, since we already have cached data to fall back on).
export async function fetchLiveQuoteStrict(
  ticker: string,
): Promise<{ price: number; name: string } | null> {
  try {
    const q = await yahooFinance.quote(ticker);
    if (!q.regularMarketPrice) return null;
    return {
      price: q.regularMarketPrice,
      name: q.longName ?? q.shortName ?? ticker,
    };
  } catch {
    return null;
  }
}

export async function getLiveQuote(ticker: string): Promise<LiveQuote> {
  const fresh = await tryFreshCache(ticker);
  if (fresh) return fresh;

  try {
    const q = await yahooFinance.quote(ticker);
    const quote: LiveQuote = {
      ticker,
      price: q.regularMarketPrice ?? 0,
      dayHigh: q.regularMarketDayHigh ?? null,
      dayLow: q.regularMarketDayLow ?? null,
      week52High: q.fiftyTwoWeekHigh ?? null,
      week52Low: q.fiftyTwoWeekLow ?? null,
      volume: q.regularMarketVolume ?? null,
      source: "live",
      asOf: new Date().toISOString(),
    };

    const { error: writeError } = await supabaseAdmin
      .from("market_snapshots")
      .insert({
        ticker,
        price: quote.price,
        day_high: quote.dayHigh,
        day_low: quote.dayLow,
        week_52_high: quote.week52High,
        week_52_low: quote.week52Low,
        volume: quote.volume,
        source: "live",
      });
    if (writeError) {
      console.warn(
        `[marketData] cache write failed for ${ticker}:`,
        writeError.message,
      );
    }

    return quote;
  } catch (err) {
    console.warn(
      `[marketData] live quote failed for ${ticker}, falling back:`,
      (err as Error).message,
    );
    return getCachedQuote(ticker);
  }
}

async function getCachedQuote(ticker: string): Promise<LiveQuote> {
  const { data, error } = await supabaseAdmin
    .from("latest_snapshots")
    .select("*")
    .eq("ticker", ticker)
    .maybeSingle();

  if (error || !data) {
    console.warn(`[marketData] no cache for ${ticker}, using synthetic`);
    return getSyntheticQuote(ticker);
  }

  return {
    ticker,
    price: Number(data.price),
    dayHigh: data.day_high !== null ? Number(data.day_high) : null,
    dayLow: data.day_low !== null ? Number(data.day_low) : null,
    week52High: data.week_52_high !== null ? Number(data.week_52_high) : null,
    week52Low: data.week_52_low !== null ? Number(data.week_52_low) : null,
    volume: data.volume ? Number(data.volume) : null,
    source: "cached",
    asOf: data.recorded_at,
  };
}

function getSyntheticQuote(ticker: string): LiveQuote {
  const base = syntheticBasePrice(ticker);
  const price =
    Math.round(base * (1 + (Math.random() - 0.5) * 0.02) * 100) / 100;
  return {
    ticker,
    price,
    dayHigh: Math.round(price * 1.01 * 100) / 100,
    dayLow: Math.round(price * 0.99 * 100) / 100,
    week52High: Math.round(price * 1.15 * 100) / 100,
    week52Low: Math.round(price * 0.85 * 100) / 100,
    volume: Math.round(1_000_000 + Math.random() * 500_000),
    source: "demo",
    asOf: new Date().toISOString(),
  };
}

export async function getHistoricalCloses(
  ticker: string,
  days = 30,
): Promise<{ closes: DailyClose[]; source: DataSource }> {
  try {
    const period2 = new Date();
    const period1 = new Date();
    period1.setDate(period1.getDate() - Math.round(days * 1.5));

    const result = await yahooFinance.chart(ticker, {
      period1: period1.toISOString().split("T")[0],
      period2: period2.toISOString().split("T")[0],
      interval: "1d",
    });

    const quotes = result.quotes || [];
    const closes: DailyClose[] = quotes
      .filter(
        (q): q is typeof q & { close: number; date: Date | string } =>
          q.close != null && q.date != null,
      )
      .map((q) => ({
        tradeDate: new Date(q.date).toISOString().slice(0, 10),
        closePrice: Math.round(q.close * 100) / 100,
      }));

    if (closes.length > 0) {
      const { error: writeError } = await supabaseAdmin
        .from("daily_prices")
        .upsert(
          closes.map((c) => ({
            ticker,
            trade_date: c.tradeDate,
            close_price: c.closePrice,
          })),
          { onConflict: "ticker,trade_date" },
        );
      if (writeError) {
        console.warn(
          `[marketData] daily_prices write failed for ${ticker}:`,
          writeError.message,
        );
      }
    }
    return { closes, source: "live" };
  } catch (err) {
    console.warn(
      `[marketData] live history failed for ${ticker}, falling back:`,
      (err as Error).message,
    );
    return getCachedHistory(ticker, days);
  }
}

// DB-only read, deliberately never hits Yahoo — used by GET /watchlist so
// rendering the list doesn't fire a live call per stock per request. Live
// data only enters daily_prices via the backfill script / getHistoricalCloses.
export async function getCachedHistory(
  ticker: string,
  days: number,
): Promise<{ closes: DailyClose[]; source: DataSource }> {
  const { data, error } = await supabaseAdmin
    .from("daily_prices")
    .select("trade_date, close_price")
    .eq("ticker", ticker)
    .order("trade_date", { ascending: true })
    .limit(days);

  if (error || !data || data.length < 5) {
    console.warn(
      `[marketData] insufficient DB history for ${ticker}, generating synthetic series`,
    );
    return { closes: generateSyntheticSeries(ticker, days), source: "demo" };
  }

  return {
    closes: data.map((r: { trade_date: string; close_price: number }) => ({
      tradeDate: r.trade_date as string,
      closePrice: Number(r.close_price),
    })),
    source: "cached",
  };
}

function generateSyntheticSeries(ticker: string, days: number): DailyClose[] {
  const startPrice = syntheticBasePrice(ticker) * 0.92;
  const dailyVolatility = ticker === "^NSEI" ? 0.008 : 0.015;
  const prices: number[] = [startPrice];

  for (let i = 1; i < days; i++) {
    const shock = (Math.random() - 0.5) * 2 * dailyVolatility;
    prices.push(Math.round(prices[i - 1] * (1 + shock) * 100) / 100);
  }

  const today = new Date();
  return prices.map((closePrice, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return { tradeDate: d.toISOString().slice(0, 10), closePrice };
  });
}

// Best-known price at/before an arbitrary timestamp — the baseline for
// "since you left" diffs. Tries the finer-grained market_snapshots first
// (a live/cached quote actually recorded near that moment); falls back to
// the daily close on/before that date if no snapshot exists that far back
// (e.g. a brand-new watchlist entry, or a first-ever session).
export async function getPriceAtOrBefore(
  ticker: string,
  timestamp: string,
): Promise<number | null> {
  const { data: snap } = await supabaseAdmin
    .from("market_snapshots")
    .select("price, recorded_at")
    .eq("ticker", ticker)
    .lte("recorded_at", timestamp)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snap) return Number(snap.price);

  const dateOnly = timestamp.slice(0, 10);
  const { data: daily } = await supabaseAdmin
    .from("daily_prices")
    .select("close_price, trade_date")
    .eq("ticker", ticker)
    .lte("trade_date", dateOnly)
    .order("trade_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return daily ? Number(daily.close_price) : null;
}
