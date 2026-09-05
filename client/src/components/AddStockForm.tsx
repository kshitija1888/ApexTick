import { useState } from "react";
import { ApiError } from "../lib/api";

export function AddStockForm({
  onAdd,
}: {
  onAdd: (ticker: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (!ticker) {
      setError("Enter a ticker first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(ticker);
      setValue("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't add that ticker.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-start gap-2 border-b border-hairline px-5 py-4"
    >
      <div className="flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Add a ticker, e.g. WIPRO.NS"
          className="w-full border border-hairline bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-ink focus:outline-none"
        />
        {error && <p className="mt-1 text-sm text-down">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="border border-ink bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add stock"}
      </button>
    </form>
  );
}
