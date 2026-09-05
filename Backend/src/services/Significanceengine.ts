import { DailyClose } from "./marketData";

// The core idea: instead of a flat "+2.5% = alert" threshold, standardize
// every move against (a) the stock's OWN historical volatility, scaled by
// random-walk theory (expected stdev over t days ~ dailyVol * sqrt(t)), and
// (b) the market's move on the same day, to separate "this stock did
// something" from "the whole market did something and this stock rode along".

export interface SignificanceInput {
  ticker: string;
  currentPrice: number;
  historicalCloses: DailyClose[]; // any order, needs >= ~10 rows to be meaningful
  indexCloses?: DailyClose[]; // ^NSEI, same shape, optional
  indexCurrentPrice?: number;
  previousVisitAt?: string | null; // from user_sessions, read BEFORE overwrite
  priceAtLastVisit?: number | null; // nearest known price at/around previousVisitAt
}

export interface SignificanceResult {
  ticker: string;
  dailyVolatility: number;
  todayReturnPct: number;
  todayZScore: number;
  idiosyncraticReturnPct: number | null;
  idiosyncraticZScore: number | null;
  sinceVisitReturnPct: number | null;
  sinceVisitZScore: number | null;
  attentionScore: number;
  badges: string[];
}

const TRADING_HOURS_PER_DAY = 6.25; // NSE: 9:15am-3:30pm
const MIN_TRADING_DAYS = 0.05; // floor so a re-check seconds later doesn't divide by ~0

function sortedByDate(closes: DailyClose[]): DailyClose[] {
  return [...closes].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
}

function dailyReturns(closes: DailyClose[]): number[] {
  const sorted = sortedByDate(closes);
  const returns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].closePrice;
    const curr = sorted[i].closePrice;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return returns;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Baseline close to compare "current price" against — the most recent close
// that ISN'T today's (so we're measuring a real move, not comparing a price
// to itself if today's close already landed in the history).
function getBaselineClose(closes: DailyClose[]): number | null {
  const sorted = sortedByDate(closes);
  if (sorted.length === 0) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const last = sorted[sorted.length - 1];
  if (last.tradeDate === todayStr && sorted.length > 1) {
    return sorted[sorted.length - 2].closePrice;
  }
  return last.closePrice;
}

function zScore(
  returnPct: number,
  dailyVol: number,
  tradingDays: number,
): number {
  if (dailyVol <= 0 || tradingDays <= 0) return 0;
  const expectedVol = dailyVol * Math.sqrt(tradingDays); // random-walk scaling
  if (expectedVol === 0) return 0;
  return returnPct / expectedVol;
}

function elapsedTradingDays(previousVisitAt: string): number {
  const elapsedMs = Date.now() - new Date(previousVisitAt).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  return Math.max(elapsedHours / TRADING_HOURS_PER_DAY, MIN_TRADING_DAYS);
}

export function evaluateSignificance(
  input: SignificanceInput,
): SignificanceResult {
  const { ticker, currentPrice, historicalCloses } = input;

  const dailyVolatility = stdDev(dailyReturns(historicalCloses));
  const baseline = getBaselineClose(historicalCloses);
  const todayReturnPct =
    baseline && baseline > 0 ? (currentPrice - baseline) / baseline : 0;
  const todayZScore = zScore(todayReturnPct, dailyVolatility, 1);

  // idiosyncratic: stock's move minus the index's move on the same window.
  // Approximation, not a rigorous beta-adjusted residual — scaled against
  // the stock's own volatility since that's the number we already trust.
  let idiosyncraticReturnPct: number | null = null;
  let idiosyncraticZScore: number | null = null;
  if (input.indexCloses && input.indexCurrentPrice != null) {
    const indexBaseline = getBaselineClose(input.indexCloses);
    if (indexBaseline && indexBaseline > 0) {
      const indexReturnPct =
        (input.indexCurrentPrice - indexBaseline) / indexBaseline;
      idiosyncraticReturnPct = todayReturnPct - indexReturnPct;
      idiosyncraticZScore = zScore(idiosyncraticReturnPct, dailyVolatility, 1);
    }
  }

  // since-you-left: same z(t) formula, evaluated at elapsed trading time
  // instead of a fixed 1 day — this is what makes "3% in 10 minutes" read
  // as more significant than "3% over 3 days".
  let sinceVisitReturnPct: number | null = null;
  let sinceVisitZScore: number | null = null;
  if (
    input.previousVisitAt &&
    input.priceAtLastVisit &&
    input.priceAtLastVisit > 0
  ) {
    sinceVisitReturnPct =
      (currentPrice - input.priceAtLastVisit) / input.priceAtLastVisit;
    const t = elapsedTradingDays(input.previousVisitAt);
    sinceVisitZScore = zScore(sinceVisitReturnPct, dailyVolatility, t);
  }

  const attentionScore =
    0.4 * Math.abs(todayZScore) +
    0.4 * Math.abs(idiosyncraticZScore ?? 0) +
    0.2 * Math.abs(sinceVisitZScore ?? 0);

  const badges: string[] = [];
  if (Math.abs(todayZScore) >= 2) badges.push("STATISTICALLY_UNUSUAL_MOVE");
  if (idiosyncraticZScore != null && Math.abs(idiosyncraticZScore) >= 1.5) {
    badges.push("MOVING_INDEPENDENT_OF_MARKET");
  }
  if (sinceVisitZScore != null && Math.abs(sinceVisitZScore) >= 2) {
    badges.push("SIGNIFICANT_SINCE_LAST_VISIT");
  }

  return {
    ticker,
    dailyVolatility: Math.round(dailyVolatility * 10000) / 10000,
    todayReturnPct: Math.round(todayReturnPct * 10000) / 10000,
    todayZScore: Math.round(todayZScore * 100) / 100,
    idiosyncraticReturnPct:
      idiosyncraticReturnPct != null
        ? Math.round(idiosyncraticReturnPct * 10000) / 10000
        : null,
    idiosyncraticZScore:
      idiosyncraticZScore != null
        ? Math.round(idiosyncraticZScore * 100) / 100
        : null,
    sinceVisitReturnPct:
      sinceVisitReturnPct != null
        ? Math.round(sinceVisitReturnPct * 10000) / 10000
        : null,
    sinceVisitZScore:
      sinceVisitZScore != null
        ? Math.round(sinceVisitZScore * 100) / 100
        : null,
    attentionScore: Math.round(attentionScore * 100) / 100,
    badges,
  };
}
