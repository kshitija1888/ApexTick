import { useMemo } from "react";
import type { WatchlistEntry } from "../lib/api";
import type { NavTab } from "./Sidebar";
import { SummaryBanner } from "./SummaryBanner";

type Status = "loading" | "ready" | "error";

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "up" | "down" | "signal";
}) {
  const toneClass =
    tone === "up"
      ? "text-up"
      : tone === "down"
        ? "text-down"
        : tone === "signal"
          ? "text-signal"
          : "text-ink";
  return (
    <div className="border border-hairline bg-paper px-5 py-4 transition-colors hover:border-ink-soft">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className={`mt-1 font-mono text-3xl ${toneClass}`}>{value}</div>
    </div>
  );
}

export function Dashboard({
  userEmail: _userEmail,
  watchlist,
  previousVisitAt,
  status,
  errorMessage,
  onNavigate,
  onOpen,
}: {
  userEmail: string;
  watchlist: WatchlistEntry[];
  previousVisitAt: string | null;
  status: Status;
  errorMessage: string;
  onNavigate: (tab: NavTab) => void;
  onOpen: (ticker: string) => void;
}) {
  const stats = useMemo(() => {
    const flagged = watchlist.filter((e) => e.significance.badges.length > 0);
    const gainers = watchlist.filter(
      (e) => e.changeSinceAddedPct !== null && e.changeSinceAddedPct > 0,
    );
    const losers = watchlist.filter(
      (e) => e.changeSinceAddedPct !== null && e.changeSinceAddedPct < 0,
    );
    return {
      tracked: watchlist.length,
      flagged: flagged.length,
      gainers: gainers.length,
      losers: losers.length,
    };
  }, [watchlist]);

  const movers = useMemo(
    () =>
      [...watchlist]
        .filter((e) => e.changeSinceAddedPct !== null)
        .sort(
          (a, b) =>
            Math.abs(b.changeSinceAddedPct ?? 0) -
            Math.abs(a.changeSinceAddedPct ?? 0),
        )
        .slice(0, 5),
    [watchlist],
  );

  const flaggedPreview = useMemo(
    () => watchlist.filter((e) => e.significance.badges.length > 0).slice(0, 3),
    [watchlist],
  );

  if (status === "loading") {
    return (
      <div className="px-5 py-16 text-center text-base text-ink-soft">
        Fetching market data and calculating signals...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="m-5 border border-down/30 bg-down-bg px-4 py-3 text-base text-down">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Headline + since-last-visit movers, shared with the Watchlist tab */}
      <SummaryBanner
        previousVisitAt={previousVisitAt}
        watchlist={watchlist}
        onOpen={onOpen}
      />

      <div className="px-5 pb-8">
        {watchlist.length === 0 ? (
          <div className="mt-10 border border-hairline bg-paper-dim px-6 py-10 text-center">
            <div className="text-2xl text-ink">Your watchlist is empty</div>
            <p className="mx-auto mt-2 max-w-[40ch] text-base text-ink-soft">
              Add a few Indian stocks and we'll start tracking which moves are
              actually worth your attention.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("watchlist")}
              className="mt-5 bg-ink px-5 py-2.5 text-base font-medium text-paper transition-opacity hover:opacity-90"
            >
              Add your first stock
            </button>
          </div>
        ) : (
          <>
            {/* Stat row */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Tracked" value={stats.tracked} />
              <StatCard
                label="Flagged"
                value={stats.flagged}
                tone={stats.flagged > 0 ? "signal" : "default"}
              />
              <StatCard label="Gainers" value={stats.gainers} tone="up" />
              <StatCard label="Losers" value={stats.losers} tone="down" />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr]">
              {/* Movers */}
              <div>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-ink">
                    Biggest moves
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate("watchlist")}
                    className="text-sm text-ink-soft hover:text-ink"
                  >
                    View all →
                  </button>
                </div>
                <div className="mt-3 divide-y divide-hairline border border-hairline">
                  {movers.map((entry) => {
                    const isUp = (entry.changeSinceAddedPct ?? 0) >= 0;
                    return (
                      <button
                        key={entry.ticker}
                        type="button"
                        onClick={() => onOpen(entry.ticker)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-paper-dim"
                      >
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-sm text-ink-soft">
                              {entry.ticker}
                            </span>
                            <span className="truncate text-base text-ink">
                              {entry.name}
                            </span>
                          </div>
                          <div className="text-sm text-ink-soft">
                            {formatPrice(entry.currentPrice)}
                          </div>
                        </div>
                        <div
                          className={`shrink-0 font-mono text-base ${isUp ? "text-up" : "text-down"}`}
                        >
                          {formatPct(entry.changeSinceAddedPct)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Signals + quick nav */}
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Signals</h2>
                  {flaggedPreview.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      Nothing statistically unusual right now.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {flaggedPreview.map((entry) => (
                        <button
                          key={entry.ticker}
                          type="button"
                          onClick={() => onOpen(entry.ticker)}
                          className="block w-full border border-signal/25 bg-signal-dim px-3 py-2 text-left transition-colors hover:bg-signal-bg/40"
                        >
                          <div className="font-mono text-sm text-ink-soft">
                            {entry.ticker}
                          </div>
                          <div className="text-sm text-signal">
                            {entry.significance.badges.length} signal
                            {entry.significance.badges.length !== 1 ? "s" : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate("signals")}
                    className="mt-3 text-sm text-ink-soft hover:text-ink"
                  >
                    Open Signals →
                  </button>
                </div>

                <div className="border-t border-hairline pt-6">
                  <h2 className="text-lg font-semibold text-ink">Jump to</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["watchlist", "Watchlist"],
                        ["signals", "Signals"],
                        ["history", "History"],
                        ["settings", "Settings"],
                      ] as [NavTab, string][]
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => onNavigate(tab)}
                        className="border border-hairline px-3 py-2.5 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
