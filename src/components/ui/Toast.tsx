import { useCallback, useState, type ReactNode } from "react";
import { SnackbarStack, type SnackbarData } from "./Snackbar";
import { AlertTriangleIcon, CheckCircleIcon } from "./icons";
import { ToastContext, type Notify } from "./toastContext";

/**
 * App-wide confirmation toasts ("MR-2026-0018 issued to Juan Dela Cruz").
 * Mounted once in DashboardLayout so a dialog several modals deep can report
 * back after it closes itself, which a page-local SnackbarStack can't do once
 * the component that owned it has unmounted. Read it with `useToast()`.
 */
export function ToastProvider({ children, className }: { children: ReactNode; className?: string }) {
  const [toasts, setToasts] = useState<SnackbarData[]>([]);

  const notify = useCallback<Notify>(({ title, description = "", tone = "success" }) => {
    setToasts((prev) => [
      { id: Date.now() + Math.random(), title, description, icon: tone === "error" ? AlertTriangleIcon : CheckCircleIcon },
      ...prev,
    ]);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <SnackbarStack
        items={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        className={className}
      />
    </ToastContext.Provider>
  );
}
