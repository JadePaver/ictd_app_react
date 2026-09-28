import { createContext, useContext } from "react";

export type Notify = (toast: { title: string; description?: string; tone?: "success" | "error" }) => void;

export const ToastContext = createContext<Notify>(() => {});

/** Shows a confirmation toast. A no-op outside a ToastProvider. */
export function useToast(): Notify {
  return useContext(ToastContext);
}
