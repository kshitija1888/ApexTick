// client/src/components/WatchlistFilters.tsx
export type FilterMode = "all" | "signals" | "up" | "down";

export function WatchlistFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  count,
}: {
  activeFilter: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-hairline px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter list by ticker or name..."
        className="w-full max-w-xs border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-soft focus:border-ink focus:outline-none"
      />

      <div className="flex items-center gap-2 text-xs">
        <span className="text-ink-soft">Show:</span>
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`px-2 py-1 ${
            activeFilter === "all"
              ? "bg-ink text-paper"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          All ({count})
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("signals")}
          className={`px-2 py-1 ${
            activeFilter === "signals"
              ? "bg-ink text-paper"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          Flagged Only
        </button>
      </div>
    </div>
  );
}
