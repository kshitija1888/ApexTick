import { useState } from "react";
import { Sidebar, type NavTab } from "./Sidebar";

interface AppLayoutProps {
  userEmail: string;
  onSignOut: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
  watchlistCount?: number;
  signalCount?: number;
}

export function AppLayout({
  userEmail,
  onSignOut,
  activeTab,
  onSelectTab,
  children,
  watchlistCount,
  signalCount,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        userEmail={userEmail}
        onSignOut={onSignOut}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        watchlistCount={watchlistCount}
        signalCount={signalCount}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-hairline px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-ink-soft hover:text-ink text-lg"
          >
            ☰
          </button>
          <span className="text-sm font-semibold text-ink">
            Smart Watchlist
          </span>
          <span className="w-6" />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
