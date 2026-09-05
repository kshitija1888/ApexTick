import type { WatchlistEntry } from "../lib/api";

const BADGE_COPY: Record<string, { short: string; detail: string }> = {
  STATISTICALLY_UNUSUAL_MOVE: {
    short: "Unusual today",
    detail:
      "Today's move is statistically large by this stock's own standards — not just vs. a flat threshold.",
  },
  MOVING_INDEPENDENT_OF_MARKET: {
    short: "Market-independent move",
    detail:
      "NIFTY's daily return is subtracted. What remains is movement the market didn't cause.",
  },
  SIGNIFICANT_SINCE_LAST_VISIT: {
    short: "Big move since your last visit",
    detail:
      "The move since you last checked is statistically large relative to how much time elapsed.",
  },
};

function ZBar({
  value,
  max = 4,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const w = Math.min(Math.abs(value) / max, 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-hairline overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${w}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs text-ink-soft">
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}σ
      </span>
    </div>
  );
}

function SignalCard({
  entry,
  onOpen,
}: {
  entry: WatchlistEntry;
  onOpen: (t: string) => void;
}) {
  const s = entry.significance;
  const isUp = s.todayReturnPct >= 0;

  return (
    <div className="border border-signal/25 bg-signal-dim rounded-sm">
      <button
        type="button"
        onClick={() => onOpen(entry.ticker)}
        className="w-full text-left p-4 hover:bg-signal-bg/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-ink-soft">
                {entry.ticker}
              </span>
              <span className="text-sm font-medium text-ink">{entry.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.significance.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 bg-signal-bg border border-signal/20 px-2 py-0.5 text-xs text-signal"
                >
                  {BADGE_COPY[badge]?.short ?? badge}
                  {entry.significance.newBadges.includes(badge) && (
                    <span className="font-medium">· new</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`font-mono text-sm font-medium ${isUp ? "text-up" : "text-down"}`}
            >
              {isUp ? "+" : ""}
              {(s.todayReturnPct * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-ink-soft">today</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div>
            <div className="mb-1 text-xs text-ink-soft">
              Today vs. own history
            </div>
            <ZBar
              value={s.todayZScore}
              color={isUp ? "var(--color-up)" : "var(--color-down)"}
            />
          </div>
          {s.idiosyncraticZScore !== null && (
            <div>
              <div className="mb-1 text-xs text-ink-soft">
                Adjusted for NIFTY
              </div>
              <ZBar value={s.idiosyncraticZScore} color="var(--color-signal)" />
            </div>
          )}
        </div>
      </button>

      <div className="border-t border-signal/15 px-4 py-2.5 space-y-1">
        {entry.significance.badges.map((badge) => (
          <p key={badge} className="text-xs text-ink-soft leading-relaxed">
            {BADGE_COPY[badge]?.detail}
          </p>
        ))}
      </div>
    </div>
  );
}

export function SignalFeed({
  watchlist,
  onOpen,
}: {
  watchlist: WatchlistEntry[];
  onOpen: (ticker: string) => void;
}) {
  const flagged = [...watchlist]
    .filter((e) => e.significance.badges.length > 0)
    .sort(
      (a, b) =>
        Math.abs(b.significance.idiosyncraticZScore ?? 0) -
        Math.abs(a.significance.idiosyncraticZScore ?? 0),
    );

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-base font-semibold text-ink">Signals</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        Sorted by market-adjusted z-score — the moves that weren't just NIFTY.
      </p>

      {flagged.length === 0 ? (
        <div className="mt-10 text-center">
          <div className="text-3xl mb-3">—</div>
          <div className="text-sm text-ink-soft">
            No statistically unusual moves in your watchlist right now.
          </div>
          <div className="mt-1 text-xs text-ink-soft">
            Market-adjusted z-scores are below the badge threshold for every
            stock.
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {flagged.map((entry) => (
            <SignalCard key={entry.ticker} entry={entry} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
