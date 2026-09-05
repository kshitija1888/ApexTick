export type NavTab =
  | "dashboard"
  | "watchlist"
  | "signals"
  | "history"
  | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userEmail: string;
  onSignOut: () => void;
  isOpen: boolean;
  onToggle: () => void;
  watchlistCount?: number;
  signalCount?: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  userEmail,
  onSignOut,
  isOpen,
  onToggle,
  watchlistCount = 0,
  signalCount = 0,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; count?: number }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "watchlist", label: "Watchlist", count: watchlistCount },
    {
      id: "signals",
      label: "Signals",
      count: signalCount > 0 ? signalCount : undefined,
    },
    { id: "history", label: "History" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed bottom-0 top-0 left-0 z-50 flex w-56 flex-col border-r border-hairline bg-paper transition-transform duration-200 md:static md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-hairline px-5">
          <button
            type="button"
            onClick={() => onSelectTab("dashboard")}
            className="text-base font-semibold text-ink hover:opacity-80"
          >
            Smart Watchlist
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="text-ink-soft hover:text-ink md:hidden"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (isOpen) onToggle();
                }}
                className={`flex w-full items-center justify-between rounded px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-dim hover:text-ink"}`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`text-xs tabular-nums ${isActive ? "text-paper/60" : "text-ink-soft"}`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-hairline p-4">
          <div className="truncate text-xs text-ink-soft">{userEmail}</div>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 text-xs text-ink-soft underline underline-offset-2 hover:text-down"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
