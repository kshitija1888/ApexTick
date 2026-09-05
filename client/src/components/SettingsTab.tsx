import { useState } from "react";

const THRESHOLDS = [
  {
    value: "1.5",
    label: "1.5σ — Sensitive",
    desc: "Flags moderate shifts. More badges, less filtering.",
  },
  {
    value: "2.0",
    label: "2.0σ — Standard",
    desc: "Flags statistically unusual moves. Recommended.",
  },
  {
    value: "3.0",
    label: "3.0σ — Strict",
    desc: "Extreme moves only. Fewer, higher-confidence signals.",
  },
];

function clearVisitLog() {
  try {
    localStorage.removeItem("smw_visit_log");
  } catch {}
}

export function SettingsTab({ userEmail }: { userEmail: string }) {
  const [threshold, setThreshold] = useState("2.0");
  const [cleared, setCleared] = useState(false);

  function handleClear() {
    clearVisitLog();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Settings</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          Account and signal configuration.
        </p>
      </div>

      {/* Account */}
      <section className="border border-hairline p-4 space-y-3">
        <h3 className="text-xs font-medium text-ink-soft uppercase tracking-wider">
          Account
        </h3>
        <div>
          <div className="text-xs text-ink-soft">Signed in as</div>
          <div className="mt-1 font-mono text-sm text-ink">{userEmail}</div>
        </div>
        <div className="text-xs text-ink-soft">
          Authentication via Supabase Auth · JWT verified server-side on every
          request.
        </div>
      </section>

      {/* Signal sensitivity */}
      <section className="border border-hairline p-4 space-y-3">
        <h3 className="text-xs font-medium text-ink-soft uppercase tracking-wider">
          Signal sensitivity
        </h3>
        <p className="text-xs text-ink-soft leading-relaxed">
          Controls the z-score threshold for the{" "}
          <em>Statistically unusual move</em> and{" "}
          <em>Significant since last visit</em> badges. Lower = more sensitive.
          This setting is local to this browser session.
        </p>
        <div className="space-y-2">
          {THRESHOLDS.map((t) => (
            <label
              key={t.value}
              className={`flex items-start gap-3 border p-3 cursor-pointer transition-colors ${threshold === t.value ? "border-ink bg-paper-dim" : "border-hairline hover:border-ink-soft"}`}
            >
              <input
                type="radio"
                name="threshold"
                value={t.value}
                checked={threshold === t.value}
                onChange={() => setThreshold(t.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-ink">{t.label}</div>
                <div className="text-xs text-ink-soft">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          Note: changing this will take effect on next watchlist load. Backend
          threshold defaults to 2.0σ.
        </p>
      </section>

      {/* Data */}
      <section className="border border-hairline p-4 space-y-3">
        <h3 className="text-xs font-medium text-ink-soft uppercase tracking-wider">
          Local data
        </h3>
        <div className="text-xs text-ink-soft leading-relaxed">
          Visit history (used to power the History tab and since-you-left diffs)
          is stored in your browser's local storage. Clear it to reset session
          tracking.
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="border border-down/40 px-3 py-1.5 text-xs text-down hover:bg-down-bg transition-colors"
        >
          {cleared ? "Cleared." : "Clear visit history"}
        </button>
      </section>

      {/* How it works */}
      <section className="border border-hairline p-4 space-y-2">
        <h3 className="text-xs font-medium text-ink-soft uppercase tracking-wider">
          How signals work
        </h3>
        <div className="space-y-2 text-xs text-ink-soft leading-relaxed">
          <p>
            <strong className="text-ink">Today's z-score:</strong> divides
            today's return by the stock's own 30-day daily volatility. A 2% move
            in a volatile stock is less significant than a 2% move in a stable
            one.
          </p>
          <p>
            <strong className="text-ink">Market-adjusted z-score:</strong>{" "}
            subtracts NIFTY's return before the z-score calculation. Removes
            correlated market movement so only stock-specific action triggers a
            badge.
          </p>
          <p>
            <strong className="text-ink">Since-last-visit z-score:</strong> same
            formula but uses elapsed trading time since your last session as the
            time window — so a 1% move in 10 minutes scores higher than 1% over
            4 days.
          </p>
          <p>
            <strong className="text-ink">Attention score:</strong> weighted
            composite of all three (40% today, 40% market-adjusted, 20%
            since-visit). Determines the sort order of your watchlist.
          </p>
        </div>
      </section>
    </div>
  );
}
