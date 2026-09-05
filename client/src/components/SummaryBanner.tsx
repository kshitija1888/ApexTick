import type { WatchlistEntry } from "../lib/api";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function MoverChip({
  entry,
  onOpen,
}: {
  entry: WatchlistEntry;
  onOpen: (ticker: string) => void;
}) {
  const pct = entry.changeSinceAddedPct;
  const isUp = pct !== null && pct >= 0;
  const flagged = entry.significance.badges.length > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.ticker)}
      className={`flex shrink-0 items-center gap-2.5 border px-3 py-2 text-left transition-colors ${
        flagged
          ? "border-signal/30 bg-signal-dim hover:bg-signal-bg/40"
          : "border-hairline bg-paper hover:border-ink-soft"
      }`}
    >
      <div
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isUp ? "bg-up" : "bg-down"
        }`}
      />
      <div className="min-w-0">
        <div className="font-mono text-xs text-ink">{entry.ticker}</div>
        <div className={`font-mono text-sm ${isUp ? "text-up" : "text-down"}`}>
          {formatPct(pct)}
        </div>
      </div>
    </button>
  );
}

export function SummaryBanner({
  previousVisitAt,
  watchlist,
  onOpen,
}: {
  previousVisitAt: string | null;
  watchlist: WatchlistEntry[];
  onOpen?: (ticker: string) => void;
}) {
  const flagged = watchlist.filter(
    (entry) => entry.significance.badges.length > 0,
  );

  const movers = [...watchlist]
    .filter((e) => e.changeSinceAddedPct !== null)
    .sort(
      (a, b) =>
        Math.abs(b.changeSinceAddedPct ?? 0) -
        Math.abs(a.changeSinceAddedPct ?? 0),
    )
    .slice(0, 8);

  let headline: string;
  if (!previousVisitAt) {
    headline = "Here's your watchlist.";
  } else if (flagged.length === 0) {
    headline = `Nothing unusual since you checked ${relativeTime(previousVisitAt)}.`;
  } else if (flagged.length === 1) {
    headline = `Since you checked ${relativeTime(previousVisitAt)}, ${flagged[0].name} moved in a way worth a look.`;
  } else {
    headline = `Since you checked ${relativeTime(previousVisitAt)}, ${flagged.length} stocks moved in ways worth a look.`;
  }

  return (
    <div className="border-b border-hairline px-5 py-6">
      <p className="max-w-[38ch] text-2xl leading-snug text-ink">{headline}</p>

      {movers.length > 0 && onOpen && (
        <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {movers.map((entry) => (
            <MoverChip key={entry.ticker} entry={entry} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
