import { useEffect, useState } from "react";
import type { WatchlistEntry } from "../lib/api";

interface SessionRecord {
  visitedAt: string;
  flaggedCount: number;
  totalCount: number;
}

const STORAGE_KEY = "smw_visit_log";
const MAX_SESSIONS = 10;

export function recordSession(
  watchlist: WatchlistEntry[],
  previousVisitAt: string | null,
) {
  if (!previousVisitAt) return;
  try {
    const existing: SessionRecord[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    const already = existing.some((s) => s.visitedAt === previousVisitAt);
    if (already) return;
    const next: SessionRecord[] = [
      {
        visitedAt: previousVisitAt,
        flaggedCount: watchlist.filter((e) => e.significance.badges.length > 0)
          .length,
        totalCount: watchlist.length,
      },
      ...existing,
    ].slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function VisitHistory({
  previousVisitAt,
}: {
  previousVisitAt: string | null;
}) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    try {
      setSessions(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {}
  }, []);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h2 className="text-base font-semibold text-ink">Visit history</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        Each row shows how many stocks were flagged when you last opened this
        session. This is the basis for "since you last checked" diffs.
      </p>

      {previousVisitAt && (
        <div className="mt-5 border border-hairline bg-paper-dim p-4">
          <div className="text-xs text-ink-soft">
            Current session started at
          </div>
          <div className="mt-1 font-mono text-sm text-ink">
            {formatDate(previousVisitAt)}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            Price diffs shown on each stock are measured from this moment.
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="mt-8 text-sm text-ink-soft">
          No prior sessions recorded yet. Visit history builds up as you open
          the app across multiple sessions.
        </div>
      ) : (
        <div className="mt-5 divide-y divide-hairline border border-hairline">
          {sessions.map((s, i) => (
            <div
              key={s.visitedAt}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm text-ink">
                  {formatDate(s.visitedAt)}
                </div>
                <div className="text-xs text-ink-soft">
                  {relativeTime(s.visitedAt)}
                </div>
              </div>
              <div className="text-right">
                {s.flaggedCount > 0 ? (
                  <div className="text-xs font-medium text-signal">
                    {s.flaggedCount} signal{s.flaggedCount !== 1 ? "s" : ""}
                  </div>
                ) : (
                  <div className="text-xs text-ink-soft">no signals</div>
                )}
                <div className="text-xs text-ink-soft">
                  {s.totalCount} stocks
                </div>
              </div>
              {i === 0 && (
                <div className="ml-3 text-xs text-ink-soft border border-hairline px-1.5 py-0.5">
                  latest
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
