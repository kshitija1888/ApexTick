# ApexTick

**A smart market watchlist that shows what actually changed — and whether it matters.**

Live demo: https://client-silk-six-20.vercel.app

> Built for the Groww CODE 2026 Hackathon · Theme: Smart Market Watchlist

---

## What it does

Most watchlists show you a price. ApexTick answers a harder question: *what changed since you last looked, and is it statistically unusual for that specific stock — or just market noise?*

When you open the app after being away, you see:

- A plain-English summary: "Since you checked 4 hours ago, TATASTEEL moved in a way worth a look"
- Stocks sorted by **attention score** — a composite of three independent z-scores, not a flat % threshold
- A detail view for each stock showing a 30-day price chart with a ±1σ volatility band and NIFTY overlay
- Live NSE/BSE market open/close status computed from IST time

---

## Why the signals are different

Every other watchlist flags a stock when it moves ±2% or hits a 52-week high. ApexTick uses three independent statistical signals:

| Signal | What it measures |
|---|---|
| **Today's z-score** | Today's return ÷ this stock's own 30-day daily volatility. A 2% move in a volatile stock is less unusual than 2% in a stable one. |
| **Market-adjusted z-score** | NIFTY's daily return is subtracted before scoring. Only moves the market *didn't* cause get flagged. |
| **Since-last-visit z-score** | Same formula, but the time window is the elapsed gap since your last session — not "since 9:15 AM". A 1% move in 10 minutes scores higher than 1% over 4 days. |

These three scores combine into a single **attention score** (weighted 40/40/20), which determines the sort order of your watchlist. No flat thresholds. No re-surfacing the same badge every refresh (dedup via `flagged_events` table).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express + TypeScript |
| Database & Auth | Supabase (PostgreSQL + Supabase Auth) |
| Market data | yahoo-finance2 v4 (live → cached → synthetic fallback chain) |
| Charts | Recharts |
| Fonts | DM Sans + DM Mono |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Project structure

```
apextick/
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx       # Post-login landing page
│   │   │   ├── WatchlistPage.tsx   # Main watchlist with filters
│   │   │   ├── StockCard.tsx       # Individual stock row
│   │   │   ├── StockDetailModal.tsx # Chart + z-score detail view
│   │   │   ├── SignalFeed.tsx      # Signals sorted by idiosyncratic z-score
│   │   │   ├── SummaryBanner.tsx   # "Since you checked X ago..."
│   │   │   ├── VisitHistory.tsx    # Session log with flagged counts
│   │   │   ├── SettingsTab.tsx     # Threshold config + methodology
│   │   │   ├── MarketStatusBadge.tsx # NSE/BSE open/close indicator
│   │   │   ├── AuthForm.tsx        # Sign in / sign up
│   │   │   ├── AppLayout.tsx       # Sidebar shell
│   │   │   ├── Sidebar.tsx         # Navigation with counts
│   │   │   ├── AddStockForm.tsx    # Ticker input with validation
│   │   │   ├── WatchlistFilters.tsx # Search + filter bar
│   │   │   └── Toast.tsx           # Notification toasts
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Supabase Auth state
│   │   ├── lib/
│   │   │   ├── api.ts              # Typed API client
│   │   │   ├── supabase.ts         # Frontend Supabase client
│   │   │   └── marketStatus.ts     # IST-based market hours calculator
│   │   ├── App.tsx
│   │   └── index.css               # Design tokens + Tailwind v4 theme
│   └── package.json
│
└── Backend/                        # Express backend
    └── src/
        ├── services/
        │   ├── marketData.ts       # Live fetch → cache → synthetic fallback
        │   ├── significanceEngine.ts # Z-score computation engine
        │   ├── backfillHistory.ts  # One-time historical data seeder
        │   └── supabase.ts         # Service-role Supabase client
        ├── controllers/
        │   ├── watchlist.ts        # CRUD + significance + detail endpoint
        │   └── user.ts             # Heartbeat (session tracking)
        ├── middleware/
        │   └── auth.ts             # Dual-mode JWT auth (JWKS + dev stub)
        ├── routes/
        │   └── api.ts
        └── index.ts
```

---

## Database schema

```sql
stocks           -- Reference table for NSE/BSE tickers + ^NSEI benchmark
watchlists       -- Per-user watched tickers with added_price
user_sessions    -- last_visited_at per user (drives since-you-left diffs)
market_snapshots -- Live price cache, refreshed on interval
daily_prices     -- 30-day historical closes per ticker (backfilled once)
flagged_events   -- Badge dedup log — prevents re-surfacing the same signal
```

**Key design decision:** `last_visited_at` is read *before* being overwritten on every session. If the heartbeat wrote first, the reference point for the since-you-left diff would be destroyed before it's used.

---

## Running locally

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- `npx tsx` (installed automatically with tsx)

### 1. Clone the repo

```bash
git clone <repo-url>
cd apextick
```

### 2. Set up the database

Open your Supabase project → SQL Editor → paste and run `schema.sql` from the repo root. This creates all six tables and seeds five NSE stocks + the `^NSEI` benchmark.

### 3. Backend setup

```bash
cd Backend
npm install
```

Create `Backend/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_MODE=supabase
PORT=4000
```

> Find these in Supabase → Settings → API.
> Use the **service_role** key (not anon) for the backend.
> `SUPABASE_JWT_SECRET` is not required — auth uses the JWKS endpoint.

Seed historical price data (run once):

```bash
npx tsx src/services/backfillHistory.ts
```

Expected output:
```
RELIANCE.NS    -> 33 rows (source: live)
TCS.NS         -> 33 rows (source: live)
...
^NSEI          -> 33 rows (source: live)
Backfill complete.
```

Start the backend:

```bash
npx tsx src/index.ts
# Server listening on port 4000
```

### 4. Frontend setup

```bash
cd client
npm install
npm install @tailwindcss/vite  # required for Tailwind v4
```

Create `client/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_BASE_URL=http://localhost:4000
```

> Use the **anon public** key (not service_role) for the frontend.

```bash
npm run dev
# Open http://localhost:5173
```

### 5. Supabase Auth setup

In your Supabase dashboard → Authentication → Providers → Email:

- Turn **off** "Confirm email" for local testing (turn on for production)

---

## How the data layer works

```
getLiveQuote(ticker)
  ├── 1. tryFreshCache() — checks market_snapshots, returns if < 45s old
  │       (prevents N users watching same ticker = N Yahoo calls)
  ├── 2. yahooFinance.quote(ticker) — live fetch, writes to market_snapshots
  └── 3. getCachedQuote() → getSyntheticQuote()  — fallback chain
         (synthetic uses real approximate base prices, not random)

getHistoricalCloses(ticker)
  ├── 1. yahooFinance.chart(ticker) — fetches ~45 days, upserts to daily_prices
  └── 2. getCachedHistory() → generateSyntheticSeries() — fallback chain
```

When a new ticker is added via `POST /api/watchlist`:
1. Validates it's a real `.NS` or `.BO` ticker via a strict live quote (no fallback — otherwise a fake ticker would get a synthesized price and silently appear to succeed)
2. Auto-registers it in `stocks` table with the real company name from Yahoo
3. **Immediately backfills 30 days of `daily_prices`** so the significance engine has real data on the first `GET /watchlist` call

---

## API endpoints

All endpoints require `Authorization: Bearer <supabase-jwt>` in production (`AUTH_MODE=supabase`). In dev mode (`AUTH_MODE` unset), pass `x-user-id: <uuid>` instead.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/watchlist` | Full watchlist with live prices + significance scores, sorted by attention score |
| `POST` | `/api/watchlist` | Add ticker (validates NSE/BSE, auto-registers, backfills history) |
| `DELETE` | `/api/watchlist/:ticker` | Remove ticker |
| `GET` | `/api/watchlist/:ticker/detail` | Full 30-day history + NIFTY overlay + significance (for chart modal) |
| `POST` | `/api/user/heartbeat` | Record session start; returns `previousVisit` timestamp before updating |

---

## Deployment

### Frontend (Vercel)

Set these environment variables in Vercel project settings:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_API_BASE_URL=https://your-backend-url.railway.app
```

Build command: `npm run build`
Output directory: `dist`

### Backend (Railway / Render)

Set these environment variables:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_MODE=supabase
PORT=4000
```

Add a `start` script in `Backend/package.json`:

```json
"scripts": {
  "start": "node --import tsx/esm src/index.ts",
  "dev": "tsx src/index.ts"
}
```

Make sure `tsx` is in `dependencies` (not just `devDependencies`) for production:

```bash
npm install tsx
```

Add to the deployed backend's CORS config in `src/index.ts`:

```typescript
app.use(cors({
  origin: ["https://client-silk-six-20.vercel.app", "http://localhost:5173"]
}));
```

---

## Key design decisions and trade-offs

**Why z-scores instead of flat thresholds?**
A flat "±2.5% = alert" rule fires equally for a stock that normally moves ±3%/day (noise) and one that normally moves ±0.5%/day (significant). Z-scores standardize against each stock's own history, so "unusual" actually means something.

**Why subtract NIFTY's move?**
On a day when NIFTY is up 2%, almost everything is up 2% — that's beta, not alpha. Subtracting the index return means only truly idiosyncratic moves trigger the "moving independent of market" badge. This is a simplified factor-model decomposition, not a rigorous beta-adjusted residual, but it's cheap to compute and easy to explain.

**Why time-scale the since-last-visit z-score?**
Random-walk theory says expected price volatility scales with √t. A 1% move over 10 minutes is measured against a much smaller expected move than 1% over 4 days. Without this scaling, a tiny intraday move after a short absence scores the same as a large move after a long absence — which is wrong.

**Why not use WebSockets for live data?**
For a watchlist that users check periodically (not a trading terminal), polling on a 45-second cache is the right trade-off. WebSocket connections for hundreds of users each watching 5-10 stocks would be expensive and complex for marginal UX gain in this context.

**Why Supabase over a custom Postgres + auth setup?**
The JWKS-based JWT verification (`/auth/v1/.well-known/jwks.json`) is handled by Supabase's infrastructure. Combined with the service-role backend client, this gives us secure server-side auth without managing key rotation.

---

## What "don't build the obvious watchlist" means in practice

The brief said: *"Don't build the obvious watchlist. Build the version you believe should exist."*

The obvious watchlist: price list, % change since open, maybe a 52-week high badge with a flat threshold.

ApexTick's version: the diff is measured from *whenever you last looked*, not from 9:15 AM. The signal is whether the move is unusual *for that specific stock*, not whether it crossed an arbitrary number. The market's move is subtracted so you see what the stock itself did. The sort order is determined by statistical significance, not insertion order.

The core thesis: most days, most stocks, nothing meaningful happens. The product should reflect that — show nothing when nothing happened, and be unmistakably clear when something did.

---

## License

MIT

---

*ApexTick — Groww CODE 2026 Hackathon submission*