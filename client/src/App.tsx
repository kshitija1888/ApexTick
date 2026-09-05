import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./components/Dashboard";
import { WatchlistPage } from "./components/WatchlistPage";
import { SignalFeed } from "./components/SignalFeed";
import { VisitHistory, recordSession } from "./components/VisitHistory";
import { SettingsTab } from "./components/SettingsTab";
import { StockDetailModal } from "./components/StockDetailModal";
import { Toast, type ToastMessage } from "./components/Toast";
import { api, type WatchlistEntry } from "./lib/api";
import { type NavTab } from "./components/Sidebar";

type Status = "loading" | "ready" | "error";

function Gate() {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ id: Date.now().toString(), message, type });
  };

  const loadWatchlist = useCallback(async () => {
    try {
      const data = await api.getWatchlist();
      setWatchlist(data.watchlist);
      setPreviousVisitAt(data.previousVisitAt);
      setStatus("ready");
      return data;
    } catch {
      setErrorMessage(
        "Couldn't reach the watchlist service. Check that the backend is running.",
      );
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadWatchlist().then((data) => {
      if (!data) return;
      // Record the just-ended session into visit history before heartbeat
      recordSession(data.watchlist, data.previousVisitAt);
      api.heartbeat().catch(() => {});
    });
  }, [user, loadWatchlist]);

  const handleAdd = async (ticker: string) => {
    await api.addToWatchlist(ticker);
    await loadWatchlist();
    showToast(`${ticker} added to your watchlist.`, "success");
  };

  const handleRemove = async (ticker: string) => {
    try {
      await api.removeFromWatchlist(ticker);
      await loadWatchlist();
      showToast(`${ticker} removed.`, "info");
    } catch {
      showToast(`Failed to remove ${ticker}.`, "error");
    }
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-base text-ink-soft">
        Loading…
      </div>
    );
  if (!user) return <AuthForm />;

  const signalCount = watchlist.filter(
    (e) => e.significance.badges.length > 0,
  ).length;

  return (
    <AppLayout
      userEmail={user.email ?? ""}
      onSignOut={signOut}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      watchlistCount={watchlist.length}
      signalCount={signalCount}
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      {activeTab === "dashboard" && (
        <Dashboard
          userEmail={user.email ?? ""}
          watchlist={watchlist}
          previousVisitAt={previousVisitAt}
          status={status}
          errorMessage={errorMessage}
          onNavigate={setActiveTab}
          onOpen={setSelectedTicker}
        />
      )}
      {activeTab === "watchlist" && (
        <WatchlistPage
          userEmail={user.email ?? ""}
          onSignOut={signOut}
          watchlist={watchlist}
          previousVisitAt={previousVisitAt}
          status={status}
          errorMessage={errorMessage}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onOpen={setSelectedTicker}
        />
      )}
      {activeTab === "signals" && (
        <SignalFeed watchlist={watchlist} onOpen={setSelectedTicker} />
      )}
      {activeTab === "history" && (
        <VisitHistory previousVisitAt={previousVisitAt} />
      )}
      {activeTab === "settings" && <SettingsTab userEmail={user.email ?? ""} />}

      {selectedTicker && (
        <StockDetailModal
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
