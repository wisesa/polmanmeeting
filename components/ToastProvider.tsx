"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastInput = {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function makeToastId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", title, message, duration = 4200 }: ToastInput) => {
      const id = makeToastId();

      setToasts((current) => [
        { id, type, title, message },
        ...current.slice(0, 4),
      ]);

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }

      return id;
    },
    [dismissToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (title, message) => showToast({ type: "success", title, message }),
      error: (title, message) => showToast({ type: "error", title, message, duration: 5600 }),
      info: (title, message) => showToast({ type: "info", title, message }),
      warning: (title, message) => showToast({ type: "warning", title, message, duration: 5200 }),
      dismissToast,
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toastItem ${toast.type}`} role="status">
            <div className="toastContent">
              <strong>{toast.title}</strong>
              {toast.message ? <span>{toast.message}</span> : null}
            </div>
            <button
              type="button"
              className="toastClose"
              aria-label="Tutup notifikasi"
              onClick={() => dismissToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast harus dipakai di dalam ToastProvider.");
  }

  return value;
}
