import { useEffect } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export function Toast({
  toast,
  onClose,
  duration = 4000,
}: {
  toast: ToastMessage | null;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [toast, onClose, duration]);

  if (!toast) return null;
  const isError = toast.type === "error";

  return (
    <div
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 max-w-sm"
    >
      <div
        role={isError ? "alert" : "status"}
        className={`flex items-center justify-between gap-3 border px-4 py-3 shadow-md ${isError ? "border-down bg-down-bg text-down" : "border-ink bg-ink text-paper"}`}
      >
        <span className="text-sm">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-xs opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
