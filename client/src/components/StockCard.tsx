import type { WatchlistEntry } from "../lib/api";

const BADGE_LABELS: Record<string, string> = {
  STATISTICALLY_UNUSUAL_MOVE: "Unusual move today",
  MOVING_INDEPENDENT_OF_MARKET: "Moving independent of the market",
  SIGNIFICANT_SINCE_LAST_VISIT: "Big move since you left",
};

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sourceLabel(source: WatchlistEntry["dataSource"]): string {
  if (source === "live") return "Live";
  if (source === "cached") return "Recently cached";
  return "Demo data";
}

export function StockCard({
  entry,
  onRemove,
  onOpen,
}: {
  entry: WatchlistEntry;
  onRemove: (ticker: string) => void;
  onOpen: (ticker: string) => void;
}) {
  const hasSignal = entry.significance.badges.length > 0;
  const isUp =
    entry.changeSinceAddedPct !== null && entry.changeSinceAddedPct >= 0;

  return (
    <div
      className={`group relative border-b border-hairline transition-colors ${
        hasSignal ? "border-l-4 border-l-signal bg-signal-bg/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(entry.ticker)}
        className="block w-full cursor-pointer px-5 py-4 text-left hover:bg-hairline/30 focus:outline-none focus-visible:bg-hairline/30"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-ink-soft">
                {entry.ticker}
              </span>
              <span className="truncate text-base text-ink">{entry.name}</span>
            </div>

            {hasSignal && (
              <ul className="mt-2 flex flex-col gap-1">
                {entry.significance.badges.map((badge) => (
                  <li
                    key={badge}
                    className="flex items-center gap-1.5 text-sm text-ink-soft"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-signal"
                      aria-hidden="true"
                    />
                    {BADGE_LABELS[badge] ?? badge}
                    {entry.significance.newBadges.includes(badge) && (
                      <span className="text-signal">· New</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 text-right">
            <div className="font-mono text-lg text-ink">
              {formatPrice(entry.currentPrice)}
            </div>
            <div
              className={`font-mono text-sm ${isUp ? "text-up" : "text-down"}`}
            >
              {formatPct(entry.changeSinceAddedPct)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
          <span>{sourceLabel(entry.dataSource)}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(entry.ticker);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRemove(entry.ticker);
              }
            }}
            className="cursor-pointer opacity-0 transition-opacity hover:text-down focus-visible:opacity-100 group-hover:opacity-100"
          >
            Remove
          </span>
        </div>
      </button>
    </div>
  );
}
