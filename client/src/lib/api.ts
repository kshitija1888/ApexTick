import { supabase } from "./supabase";

const rawBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "https://apextick-1.onrender.com";
const BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export type DataSource = "live" | "cached" | "demo";

export interface Significance {
  ticker: string;
  dailyVolatility: number;
  todayReturnPct: number;
  todayZScore: number;
  idiosyncraticReturnPct: number | null;
  idiosyncraticZScore: number | null;
  sinceVisitReturnPct: number | null;
  sinceVisitZScore: number | null;
  attentionScore: number;
  badges: string[];
  newBadges: string[];
}

export interface WatchlistEntry {
  ticker: string;
  name: string;
  sector: string | null;
  addedPrice: number;
  currentPrice: number;
  changeSinceAddedPct: number | null;
  dataSource: DataSource;
  asOf: string;
  significance: Significance;
}

export interface WatchlistResponse {
  watchlist: WatchlistEntry[];
  previousVisitAt: string | null;
}

export interface DailyClose {
  tradeDate: string;
  closePrice: number;
}

export interface StockDetail {
  ticker: string;
  name: string;
  sector: string | null;
  addedPrice: number;
  currentPrice: number;
  dataSource: DataSource;
  asOf: string;
  history: DailyClose[];
  historySource: DataSource;
  index: {
    ticker: string;
    currentPrice: number;
    history: DailyClose[];
  };
  priceAtLastVisit: number | null;
  previousVisitAt: string | null;
  significance: Significance;
}

export interface HeartbeatResponse {
  previousVisit: string | null;
  currentVisit: string;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.error ?? `Request failed (${res.status})`,
    );
  }

  return body as T;
}

export const api = {
  getWatchlist: async (): Promise<WatchlistResponse> => {
    const res = await request<WatchlistResponse>("/api/watchlist");
    return {
      watchlist: res?.watchlist ?? [],
      previousVisitAt: res?.previousVisitAt ?? null,
    };
  },

  getStockDetail: (ticker: string) =>
    request<StockDetail>(`/api/watchlist/${encodeURIComponent(ticker)}/detail`),

  addToWatchlist: (ticker: string) =>
    request<{
      watchlistEntry: unknown;
      addedAtPrice: number;
      dataSource: DataSource;
    }>("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker }) }),

  removeFromWatchlist: (ticker: string) =>
    request<void>(`/api/watchlist/${encodeURIComponent(ticker)}`, {
      method: "DELETE",
    }),

  heartbeat: () =>
    request<HeartbeatResponse>("/api/user/heartbeat", { method: "POST" }),
};

export { ApiError };
