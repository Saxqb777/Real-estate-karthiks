// Toast store + imperative API. Render <Toaster /> once (the app shell does); call toast() anywhere on the client.

export type ToastKind = "success" | "error" | "info" | "coin";

export interface ToastOptions {
  description?: string;
  /** ms; defaults by kind (errors stay longer). 0 = until dismissed. */
  duration?: number;
  /** Coin toasts: amount shown as a counting "+₹25,000". */
  amount?: number;
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: number;
  kind: ToastKind;
  title: string;
  duration: number;
}

const DEFAULT_MS: Record<ToastKind, number> = { success: 3800, info: 4200, error: 6500, coin: 5000 };
const MAX = 5;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeToasts(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export const getToasts = () => items;
const EMPTY: ToastItem[] = [];
export const getServerToasts = () => EMPTY;

function push(kind: ToastKind, title: string, opts: ToastOptions = {}): number {
  // collapse identical messages fired in a burst (e.g. several failed requests)
  const dupe = items.find((t) => t.kind === kind && t.title === title && t.description === opts.description);
  if (dupe) return dupe.id;
  const id = nextId++;
  items = [...items, { id, kind, title, ...opts, duration: opts.duration ?? DEFAULT_MS[kind] }].slice(-MAX);
  emit();
  return id;
}

export function dismissToast(id?: number) {
  items = id === undefined ? [] : items.filter((t) => t.id !== id);
  emit();
}

type ToastFn = ((title: string, opts?: ToastOptions & { kind?: ToastKind }) => number) & {
  success: (title: string, opts?: ToastOptions) => number;
  error: (title: string, opts?: ToastOptions) => number;
  info: (title: string, opts?: ToastOptions) => number;
  /** Celebration with a coin burst, e.g. toast.coin("Rent collected · Front unit", { amount: 25000 }) */
  coin: (title: string, opts?: ToastOptions) => number;
  dismiss: (id?: number) => void;
};

export const toast: ToastFn = Object.assign((title: string, opts?: ToastOptions & { kind?: ToastKind }) => push(opts?.kind ?? "info", title, opts), {
  success: (title: string, opts?: ToastOptions) => push("success", title, opts),
  error: (title: string, opts?: ToastOptions) => push("error", title, opts),
  info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  coin: (title: string, opts?: ToastOptions) => push("coin", title, opts),
  dismiss: dismissToast,
});
