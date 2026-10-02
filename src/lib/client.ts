// Client-side API helpers: api() fetch wrapper, useApi() cached query hook with request de-dupe,
// invalidate() to refresh every mounted query under a path prefix, and useMutation() that toasts errors.
//
//   const { data, loading, error, reload } = useApi<{ items: Unit[] }>("/api/units");
//   const save = useMutation((body: UnitInput) => api<Unit>("/api/units", { method: "POST", body }), { success: "Unit created" });
//   const unit = await save.run(values);   // undefined on failure (error already toasted)
//
// After any successful mutation every mounted query under "/api/" refetches by default, so saving on
// one panel refreshes the others (dashboard included). Narrow it with `invalidate: ["/api/units"]`.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "@/components/ui/toast";

// ---------------------------------------------------------------- api()

export interface ApiIssue {
  field: string;
  message: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: ApiIssue[] = [],
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** { fieldName: message } for wiring into <Field error={…}>. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const i of this.issues) if (!(i.field in out)) out[i.field] = i.message;
    return out;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialised unless it is FormData. */
  body?: unknown;
  /** Appended as a query string; null / undefined / "" values are skipped. */
  query?: Query;
  signal?: AbortSignal;
}

/** Build "?a=1&b=2" (skips null / undefined / ""). Returns "" when nothing is set. */
export function qs(query?: Query): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

let redirecting = false;

/** fetch() wrapper: JSON in/out, throws ApiClientError with the server's `error` message, redirects to /login on 401. */
export async function api<T = unknown>(path: string, { method, body, query, signal }: ApiOptions = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path + qs(query), {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: body === undefined || isForm ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiClientError("Can't reach the server — check your connection and try again", 0);
  }

  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
    if (!redirecting) {
      redirecting = true;
      const next = window.location.pathname + window.location.search + window.location.hash;
      window.location.assign(`/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`);
    }
    throw new ApiClientError("Your session has ended — please sign in again", 401);
  }

  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  const data: unknown = type.includes("application/json") ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const obj = (data && typeof data === "object" ? data : {}) as { error?: string; issues?: ApiIssue[]; details?: unknown };
    const message = obj.error ?? (typeof data === "string" && data.length < 200 && data ? data : `Request failed (${res.status})`);
    throw new ApiClientError(message, res.status, obj.issues ?? [], obj.details);
  }
  return data as T;
}

// ---------------------------------------------------------------- query cache

interface Entry<T = unknown> {
  data?: T;
  error?: ApiClientError;
  fetching: boolean;
  fetchedAt: number;
  stale: boolean;
}

const EMPTY: Entry = { fetching: false, fetchedAt: 0, stale: true };
const cache = new Map<string, Entry>();
const inflight = new Map<string, { seq: number; promise: Promise<unknown> }>();
const listeners = new Map<string, Set<() => void>>();
let seqCounter = 0;

function setEntry(key: string, patch: Partial<Entry>) {
  cache.set(key, { ...(cache.get(key) ?? EMPTY), ...patch });
  listeners.get(key)?.forEach((l) => l());
}

function toClientError(err: unknown): ApiClientError {
  return err instanceof ApiClientError ? err : new ApiClientError((err as Error)?.message || "Something went wrong", 0);
}

/** Fetch a key into the cache. Concurrent calls share one request unless `force` (then the newest wins). */
export function fetchQuery<T>(key: string, force = false): Promise<T> {
  const running = inflight.get(key);
  if (running && !force) return running.promise as Promise<T>;
  const seq = ++seqCounter;
  setEntry(key, { fetching: true });
  const promise = api<T>(key).then(
    (data) => {
      if (inflight.get(key)?.seq === seq) setEntry(key, { data, error: undefined, fetching: false, fetchedAt: Date.now(), stale: false });
      return data;
    },
    (err) => {
      const error = toClientError(err);
      if (inflight.get(key)?.seq === seq) setEntry(key, { error, fetching: false, fetchedAt: Date.now(), stale: false });
      throw error;
    },
  );
  inflight.set(key, { seq, promise });
  promise
    .catch(() => {})
    .finally(() => {
      if (inflight.get(key)?.seq === seq) inflight.delete(key);
    });
  return promise;
}

/**
 * Refetch every mounted query whose path starts with one of the prefixes ("/api/" = everything);
 * unmounted cached entries are marked stale and refetch on next use.
 */
export function invalidate(prefixes: string | string[] = "/api/") {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const key of [...cache.keys()]) {
    if (!list.some((p) => key.startsWith(p))) continue;
    if (listeners.get(key)?.size) void fetchQuery(key, true).catch(() => {});
    else setEntry(key, { stale: true });
  }
}

/** Read a cached value (e.g. to seed a form). */
export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

/** Overwrite a cached value (optimistic updates). */
export function setCached<T>(key: string, updater: T | ((current: T | undefined) => T)) {
  const current = cache.get(key)?.data as T | undefined;
  const data = typeof updater === "function" ? (updater as (c: T | undefined) => T)(current) : updater;
  setEntry(key, { data, error: undefined, fetchedAt: Date.now() });
}

export interface UseApiOptions {
  /** Skip refetching on mount if the cached value is younger than this (ms, default 2000). */
  dedupeMs?: number;
  /** Keep showing the previous key's data while a new key loads (e.g. changing a year filter). */
  keepPrevious?: boolean;
}

export interface UseApiResult<T> {
  data: T | undefined;
  error: ApiClientError | undefined;
  /** true while there is no data yet (first load). */
  loading: boolean;
  /** true whenever a request for this key is running (incl. background refreshes). */
  refreshing: boolean;
  reload: () => Promise<T | undefined>;
  /** Replace cached data locally; pass revalidate=true to refetch afterwards. */
  mutate: (updater: T | ((current: T | undefined) => T), revalidate?: boolean) => void;
}

/** Cached GET with de-duped requests. Pass null to skip (e.g. until an id is known). */
export function useApi<T>(path: string | null, { dedupeMs = 2000, keepPrevious = false }: UseApiOptions = {}): UseApiResult<T> {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!path) return () => {};
      let set = listeners.get(path);
      if (!set) listeners.set(path, (set = new Set()));
      set.add(cb);
      return () => {
        set!.delete(cb);
      };
    },
    [path],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => (path ? (cache.get(path) ?? EMPTY) : EMPTY),
    () => EMPTY,
  ) as Entry<T>;

  useEffect(() => {
    if (!path) return;
    const e = cache.get(path);
    const fresh = e && !e.stale && Date.now() - e.fetchedAt < dedupeMs;
    if (!fresh && !inflight.has(path)) void fetchQuery<T>(path).catch(() => {});
  }, [path, dedupeMs]);

  const previous = useRef<T | undefined>(undefined);
  useEffect(() => {
    if (entry.data !== undefined) previous.current = entry.data;
  }, [entry.data]);

  const reload = useCallback(async () => {
    if (!path) return undefined;
    try {
      return await fetchQuery<T>(path, true);
    } catch {
      return undefined;
    }
  }, [path]);

  const mutate = useCallback(
    (updater: T | ((current: T | undefined) => T), revalidate = false) => {
      if (!path) return;
      setCached<T>(path, updater);
      if (revalidate) void fetchQuery(path, true).catch(() => {});
    },
    [path],
  );

  const data = entry.data ?? (keepPrevious ? previous.current : undefined);
  return {
    data,
    error: entry.error,
    loading: Boolean(path) && data === undefined && (entry.fetching || !entry.error),
    refreshing: entry.fetching,
    reload,
    mutate,
  };
}

// ---------------------------------------------------------------- mutations

export interface MutationOptions<TResult, TArgs extends unknown[]> {
  /** Success toast: a title, or a function returning one (return null to skip). */
  success?: string | ((result: TResult, ...args: TArgs) => string | null);
  /** Toast the error message automatically (default true). */
  toastError?: boolean;
  /** Path prefixes to refresh after success (default "/api/" = all mounted queries). false = none. */
  invalidate?: string | string[] | false;
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  onError?: (error: ApiClientError, ...args: TArgs) => void;
}

export interface MutationState<TResult, TArgs extends unknown[]> {
  /** Resolves to the result, or undefined if it failed (the error is already toasted). */
  run: (...args: TArgs) => Promise<TResult | undefined>;
  loading: boolean;
  error: ApiClientError | null;
  /** Field → message from the last error's zod issues (for <Field error>). */
  fieldErrors: Record<string, string>;
  reset: () => void;
}

/** Wrap a write request: tracks loading/error, toasts errors, refreshes queries on success. */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult, TArgs> = {},
): MutationState<TResult, TArgs> {
  const [state, setState] = useState<{ loading: boolean; error: ApiClientError | null }>({ loading: false, error: null });
  const latest = useRef({ fn, options });
  useEffect(() => {
    latest.current = { fn, options };
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    const { fn: f, options: o } = latest.current;
    setState({ loading: true, error: null });
    try {
      const result = await f(...args);
      if (mounted.current) setState({ loading: false, error: null });
      if (o.invalidate !== false) invalidate(o.invalidate ?? "/api/");
      const msg = typeof o.success === "function" ? o.success(result, ...args) : o.success;
      if (msg) toast.success(msg);
      o.onSuccess?.(result, ...args);
      return result;
    } catch (err) {
      const error = toClientError(err);
      if (mounted.current) setState({ loading: false, error });
      if (o.toastError !== false && error.status !== 401) toast.error(error.message);
      o.onError?.(error, ...args);
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ loading: false, error: null }), []);
  return { run, loading: state.loading, error: state.error, fieldErrors: state.error?.fieldErrors ?? {}, reset };
}

// ---------------------------------------------------------------- session

/** Sign out and go to /login. */
export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    cache.clear();
    window.location.assign("/login");
  }
}
