import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";
import { api, type StockDetail, ApiError } from "../lib/api";

const BADGE_LABELS: Record<string, string> = {
  STATISTICALLY_UNUSUAL_MOVE: "Unusual move today",
  MOVING_INDEPENDENT_OF_MARKET: "Moving independent of the market",
  SIGNIFICANT_SINCE_LAST_VISIT: "Big move since you left",
};

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Both series get rebased to 100 at the earliest common date, so their very
// different absolute scales (₹280 vs ~₹24,000) can share a Y-axis and
// "moving together" vs "diverging" reads as literal line shape.
function buildChartData(detail: StockDetail) {
  const stockHistory = detail.history;
  const indexHistory = detail.index.history;

  if (stockHistory.length === 0) return [];

  const stockBase = stockHistory[0].closePrice;
  const indexBase = indexHistory[0]?.closePrice ?? 1;
  const indexByDate = new Map(
    indexHistory.map((r) => [r.tradeDate, r.closePrice]),
  );

  const rows = stockHistory.map((row) => {
    const stockRebased = (row.closePrice / stockBase) * 100;
    const indexRawOnDate = indexByDate.get(row.tradeDate);
    const indexRebased =
      indexRawOnDate !== undefined ? (indexRawOnDate / indexBase) * 100 : null;

    // ±1σ band, converted from a return z-score to a price z-score around
    // the baseline (100). Volatility of 1.46% -> band spans ~98.54 to ~101.46.
    const oneSigmaPct = detail.significance.dailyVolatility * 100;

    return {
      date: row.tradeDate.slice(5), // "MM-DD"
      stock: Math.round(stockRebased * 100) / 100,
      index:
        indexRebased !== null ? Math.round(indexRebased * 100) / 100 : null,
      bandUpper: 100 + oneSigmaPct,
      bandLower: 100 - oneSigmaPct,
    };
  });

  // Append today's live price as one more point, rebased the same way.
  const todayRebasedStock = (detail.currentPrice / stockBase) * 100;
  const todayRebasedIndex = (detail.index.currentPrice / indexBase) * 100;
  rows.push({
    date: "today",
    stock: Math.round(todayRebasedStock * 100) / 100,
    index: Math.round(todayRebasedIndex * 100) / 100,
    bandUpper: rows[0].bandUpper,
    bandLower: rows[0].bandLower,
  });

  return rows;
}

function zScoreLabel(
  z: number | null,
  name: string,
): { label: string; verdict: string } {
  if (z === null) {
    return {
      label: `${name}: —`,
      verdict:
        "Not enough data yet — either brand new to your watchlist, or the market is closed.",
    };
  }
  const abs = Math.abs(z);
  let verdict: string;
  if (abs < 1) verdict = "Well within normal range — nothing unusual.";
  else if (abs < 2) verdict = "A bit larger than typical, but not surprising.";
  else if (abs < 3) verdict = "Statistically unusual for this stock.";
  else verdict = "A very large move by this stock's own standards.";
  return { label: `${name}: ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ`, verdict };
}

export function StockDetailModal({
  ticker,
  onClose,
}: {
  ticker: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getStockDetail(ticker)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.message : "Couldn't load details.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const chartData = detail ? buildChartData(detail) : [];
  const today = zScoreLabel(
    detail?.significance.todayZScore ?? null,
    "Today's move",
  );
  const idio = zScoreLabel(
    detail?.significance.idiosyncraticZScore ?? null,
    "Vs. NIFTY",
  );
  const sinceVisit = zScoreLabel(
    detail?.significance.sinceVisitZScore ?? null,
    "Since last visit",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-auto bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-hairline px-6 py-4">
          <div>
            <div className="font-mono text-sm text-ink-soft">{ticker}</div>
            <h2 className="text-xl text-ink">{detail?.name ?? "Loading…"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {error && <p className="px-6 py-8 text-down">{error}</p>}

        {!error && !detail && (
          <p className="px-6 py-8 text-ink-soft">Loading details…</p>
        )}

        {detail && (
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[2fr_1fr]">
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-xs text-ink-soft">
                  Price rebased to 100 at start of window; ±1σ band = this
                  stock's own normal daily volatility.
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid
                      stroke="#DCDCD7"
                      strokeDasharray="1 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#5B5D5A" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#5B5D5A" }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#F2F3F0",
                        border: "1px solid #DCDCD7",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="bandUpper"
                      stroke="none"
                      fill="#C17817"
                      fillOpacity={0.08}
                      name="±1σ normal range"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="bandLower"
                      stroke="none"
                      fill="#F2F3F0"
                      fillOpacity={1}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="index"
                      stroke="#5B5D5A"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      dot={false}
                      name="NIFTY 50"
                    />
                    <Line
                      type="monotone"
                      dataKey="stock"
                      stroke="#1B1D1C"
                      strokeWidth={2}
                      dot={false}
                      name={detail.name}
                    />
                    <ReferenceLine y={100} stroke="#DCDCD7" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm">
              <div>
                <div className="text-xs text-ink-soft">Current price</div>
                <div className="font-mono text-2xl text-ink">
                  {formatPrice(detail.currentPrice)}
                </div>
                <div className="text-xs text-ink-soft">
                  {detail.dataSource === "live"
                    ? "Live"
                    : detail.dataSource === "cached"
                      ? "Recently cached"
                      : "Demo data"}
                </div>
              </div>

              <div className="border-t border-hairline pt-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-ink-soft">
                  What the numbers say
                </div>
                <ul className="flex flex-col gap-3">
                  <li>
                    <div className="font-mono">{today.label}</div>
                    <div className="text-ink-soft">{today.verdict}</div>
                  </li>
                  <li>
                    <div className="font-mono">{idio.label}</div>
                    <div className="text-ink-soft">{idio.verdict}</div>
                  </li>
                  <li>
                    <div className="font-mono">{sinceVisit.label}</div>
                    <div className="text-ink-soft">{sinceVisit.verdict}</div>
                  </li>
                </ul>
              </div>

              {detail.significance.badges.length > 0 && (
                <div className="border-t border-hairline pt-4">
                  <div className="mb-2 text-xs uppercase tracking-wider text-ink-soft">
                    Why this stood out
                  </div>
                  <ul className="flex flex-col gap-1">
                    {detail.significance.badges.map((b) => (
                      <li key={b} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-signal"
                          aria-hidden="true"
                        />
                        {BADGE_LABELS[b] ?? b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
