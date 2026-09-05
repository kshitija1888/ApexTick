import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

const TICKER_FEED = [
  { t: "TCS.NS", d: "+1.84%", up: true },
  { t: "RELIANCE.NS", d: "-0.62%", up: false },
  { t: "HDFCBANK.NS", d: "+0.31%", up: true },
  { t: "INFY.NS", d: "+2.47%", up: true },
  { t: "WIPRO.NS", d: "-1.15%", up: false },
  { t: "ITC.NS", d: "+0.08%", up: true },
];

const FEATURES = [
  {
    title: "Statistical signals, not raw %",
    desc: "Z-scores against each stock's own volatility — not a flat threshold applied to everything.",
  },
  {
    title: "Your market vs. the market",
    desc: "We strip out NIFTY's daily move so you see what the stock itself did.",
  },
  {
    title: "Since you last checked",
    desc: "The diff is measured from whenever you were last here, not from market open.",
  },
];

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password) && /[0-9]/.test(password),
  ].filter(Boolean).length;

  if (!password) return null;

  const label = ["Weak", "Okay", "Strong"][Math.max(score - 1, 0)];
  const color = ["bg-down", "bg-signal", "bg-up"][Math.max(score - 1, 0)];

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < score ? color : "bg-hairline"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );
}

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const shakeRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const id = setInterval(
      () => setTickerIndex((i) => (i + 1) % TICKER_FEED.length),
      2200,
    );
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result =
      mode === "signIn"
        ? await signIn(email, password)
        : await signUp(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      shakeRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 320, easing: "ease-out" },
      );
      return;
    }
    if (mode === "signUp") setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6">
        <div className="w-full max-w-sm animate-[fadeIn_0.4s_ease-out]">
          <div className="mb-8 text-4xl">📬</div>
          <h1 className="text-2xl font-semibold text-ink">Check your inbox</h1>
          <p className="mt-3 text-sm text-ink-soft leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-ink">{email}</strong>. Click it to activate
            your account, then sign in.
          </p>
          <p className="mt-4 text-xs text-ink-soft">
            If email confirmation is disabled in your Supabase project, you can{" "}
            <button
              type="button"
              onClick={() => {
                setCheckEmail(false);
                setMode("signIn");
              }}
              className="underline underline-offset-2 hover:text-ink"
            >
              sign in directly.
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Left panel — product identity, now a live-feeling market strip */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between overflow-hidden bg-ink p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #F2F3F0 1px, transparent 1px), linear-gradient(to bottom, #F2F3F0 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />

        <div className="relative flex items-center justify-between">
          <div className="text-2xl">📈</div>
          <div className="flex items-center gap-2 overflow-hidden rounded-full border border-ink-mid bg-ink-mid/20 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
            </span>
            <span
              key={tickerIndex}
              className="animate-[fadeIn_0.3s_ease-out] font-mono text-xs text-paper"
            >
              {TICKER_FEED[tickerIndex].t}{" "}
              <span
                className={
                  TICKER_FEED[tickerIndex].up ? "text-up" : "text-down"
                }
              >
                {TICKER_FEED[tickerIndex].d}
              </span>
            </span>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-semibold text-paper leading-tight">
            Not just what changed.
            <br />
            <span className="text-ink-soft font-normal italic">
              What actually matters.
            </span>
          </h1>
          <div className="mt-8 space-y-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="group border-l-2 border-ink-mid pl-4 transition-colors duration-200 hover:border-signal"
                style={{
                  animation: `fadeIn 0.4s ease-out ${i * 0.08}s both`,
                }}
              >
                <div className="text-sm font-medium text-paper">{f.title}</div>
                <div className="mt-0.5 text-xs text-ink-soft leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-ink-mid">
          NSE / BSE · Indian markets
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-xs">
          <div className="mb-1 text-xs text-ink-soft">
            {mode === "signIn" ? "Welcome back" : "Create an account"}
          </div>
          <h2 className="mb-8 text-2xl font-semibold text-ink">
            {mode === "signIn" ? "Sign in" : "Get started"}
          </h2>

          <form
            ref={shakeRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
          >
            <div
              className={`relative border transition-colors ${
                focusedField === "email" ? "border-ink" : "border-hairline"
              }`}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="Email address"
                className="w-full bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:outline-none"
              />
            </div>

            <div>
              <div
                className={`relative flex items-center border transition-colors ${
                  focusedField === "password" ? "border-ink" : "border-hairline"
                }`}
              >
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Password"
                  className="w-full bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  className="px-3 text-xs text-ink-soft hover:text-ink"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {mode === "signUp" && <PasswordStrength password={password} />}
            </div>

            {error && (
              <div className="border border-down/30 bg-down-bg px-3 py-2 text-sm text-down animate-[fadeIn_0.2s_ease-out]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 relative overflow-hidden bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                  Working…
                </span>
              ) : mode === "signIn" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
            }}
            className="mt-5 text-sm text-ink-soft hover:text-ink"
          >
            {mode === "signIn"
              ? "Don't have an account? Sign up →"
              : "Already have an account? Sign in →"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
