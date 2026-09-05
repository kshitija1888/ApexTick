import { useState, useMemo } from "react";
import type { WatchlistEntry } from "../lib/api";
import { SummaryBanner } from "./SummaryBanner";
import { AddStockForm } from "./AddStockForm";
import { StockCard } from "./StockCard";
import { WatchlistFilters, type FilterMode } from "./WatchlistFilters";

type Status = "loading" | "ready" | "error";

export function WatchlistPage({
  userEmail: _ue,
  onSignOut: _os,
  watchlist,
  previousVisitAt,
  status,
  errorMessage,
  onAdd,
  onRemove,
  onOpen,
}: {
  userEmail: string;
  onSignOut: () => void;
  watchlist: WatchlistEntry[];
  previousVisitAt: string | null;
  status: Status;
  errorMessage: string;
  onAdd: (ticker: string) => Promise<void>;
  onRemove: (ticker: string) => Promise<void>;
  onOpen: (ticker: string) => void;
}) {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(
    () =>
      watchlist.filter((entry) => {
        const q = searchQuery.toLowerCase();
        const matches =
          entry.ticker.toLowerCase().includes(q) ||
          entry.name.toLowerCase().includes(q);
        if (!matches) return false;
        if (filterMode === "signals")
          return entry.significance.badges.length > 0;
        return true;
      }),
    [watchlist, searchQuery, filterMode],
  );

  return (
    <div className="mx-auto max-w-2xl">
      {status === "loading" && (
        <div className="px-5 py-16 text-center text-sm text-ink-soft">
          Fetching market data and calculating signals…
        </div>
      )}
      {status === "error" && (
        <div className="m-5 border border-down/30 bg-down-bg px-4 py-3 text-sm text-down">
          {errorMessage}
        </div>
      )}
      {status === "ready" && (
        <>
          <SummaryBanner
            previousVisitAt={previousVisitAt}
            watchlist={watchlist}
            onOpen={onOpen}
          />
          <AddStockForm onAdd={onAdd} />

          {watchlist.length > 0 && (
            <WatchlistFilters
              activeFilter={filterMode}
              onFilterChange={setFilterMode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              count={watchlist.length}
            />
          )}

          {watchlist.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm text-ink-soft">Your watchlist is empty.</p>
              <p className="mt-1 text-xs text-ink-soft">
                Add Indian stocks above — e.g.{" "}
                <code className="font-mono">TCS.NS</code> or{" "}
                <code className="font-mono">RELIANCE.NS</code>
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-ink-soft">
              No stocks match that search or filter.
            </div>
          ) : (
            <div>
              {filtered.map((entry) => (
                <StockCard
                  key={entry.ticker}
                  entry={entry}
                  onRemove={onRemove}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
