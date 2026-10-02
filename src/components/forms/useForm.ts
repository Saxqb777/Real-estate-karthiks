"use client";
// Form state for every data-entry form: values, client validation with the SAME zod schemas the API uses,
// server issues mapped back onto fields, focus tracking (drives the 3D highlight in Config) and submit via useMutation.
//
//   const form = useForm({ initial, schema: tenantCreateSchema, submit: (body) => api("/api/tenants", { method: "POST", body }) });
//   <Field label="Name" error={form.error("name")}><Input {...form.text("name")} /></Field>
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type FormEvent } from "react";
import type { ZodType } from "zod";
import { useMutation, type ApiClientError, type MutationOptions } from "@/lib/client";

export type FieldErrors = Record<string, string>;
export interface Issue {
  field: string;
  message: string;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * zod / API messages are written to follow the field name ("is required", "must be greater than 0").
 * Under a visible label they read better as "Required" / "Must be greater than 0".
 */
export function fieldMessage(message: string): string {
  const m = message.trim();
  if (/^is required/i.test(m)) return "Required" + m.slice("is required".length);
  if (/^is /.test(m)) return cap(m.slice(3));
  return cap(m);
}

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export interface UseFormOptions<V extends Record<string, unknown>, R> {
  initial: V;
  /** Validates toBody(values) — pass the same schema the API route parses. */
  schema?: ZodType;
  /** UI values → request body (default: the values as they are). */
  toBody?: (values: V) => Record<string, unknown>;
  /** Extra client rules (cross-field checks, conflicts with existing records) — shared helpers from src/lib/schemas. */
  rules?: (values: V) => Issue[];
  /** Server field → form field (e.g. periodYear → periodMonth when both live in one control). */
  aliases?: Record<string, string>;
  /** Pin a server error that has no field onto one (e.g. "position already taken" → position). */
  errorField?: (error: ApiClientError) => string | undefined;
  submit: (body: Record<string, unknown>, values: V) => Promise<R>;
  /** Success toast (string or builder). Return null to skip (e.g. when you show a coin toast in onSaved). */
  success?: MutationOptions<R, [Record<string, unknown>, V]>["success"];
  /** Query prefixes to refresh (default: everything under /api/, so the dashboard updates too). */
  invalidate?: string | string[];
  onSaved?: (result: R, values: V) => void;
  /** Called on every change (live previews). */
  onValuesChange?: (values: V) => void;
  /** Called when focus moves to a named control inside the form body (null when focus leaves the form). */
  onFocusField?: (field: string | null) => void;
}

export function useForm<V extends Record<string, unknown>, R = unknown>(opts: UseFormOptions<V, R>) {
  const { initial, schema, toBody, rules, aliases, errorField } = opts;
  const [values, setValues] = useState<V>(initial);
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initial));
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });

  const bodyOf = useCallback((v: V) => (toBody ? toBody(v) : (v as Record<string, unknown>)), [toBody]);

  /** Client-side problems for a set of values: zod issues first, then the extra rules. */
  const validate = useCallback(
    (v: V): FieldErrors => {
      const out: FieldErrors = {};
      if (schema) {
        const r = schema.safeParse(bodyOf(v));
        if (!r.success) {
          for (const i of r.error.issues) {
            const raw = String(i.path[0] ?? "_form");
            const f = aliases?.[raw] ?? raw;
            if (!(f in out)) out[f] = fieldMessage(i.message);
          }
        }
      }
      for (const i of rules?.(v) ?? []) {
        const f = aliases?.[i.field] ?? i.field;
        if (!(f in out)) out[f] = fieldMessage(i.message);
      }
      return out;
    },
    [schema, rules, aliases, bodyOf],
  );

  const clientErrors = useMemo(() => validate(values), [validate, values]);
  const dirty = JSON.stringify(values) !== baseline;

  useEffect(() => {
    latest.current.onValuesChange?.(values);
  }, [values]);

  const mutation = useMutation((body: Record<string, unknown>, v: V) => latest.current.submit(body, v), {
    toastError: false,
    success: opts.success,
    invalidate: opts.invalidate,
    onSuccess: (result, _body, v) => {
      setBaseline(JSON.stringify(v));
      setAttempted(false);
      setTouched(new Set());
      latest.current.onSaved?.(result, v);
    },
    onError: (err, _body, v) => {
      const fe: FieldErrors = {};
      let unmatched = false;
      for (const i of err.issues) {
        const f = aliases?.[i.field] ?? i.field;
        if (f in v) {
          if (!(f in fe)) fe[f] = fieldMessage(i.message);
        } else unmatched = true;
      }
      const pinned = !err.issues.length ? errorField?.(err) : undefined;
      if (pinned && pinned in v) fe[pinned] = err.message;
      setServerErrors(fe);
      const fields = Object.keys(fe);
      setFormError(fields.length === 0 || unmatched ? err.message : null);
      if (fields.length) focusField(fields[0]);
      else requestAnimationFrame(() => bodyRef.current?.querySelector("[data-form-error]")?.scrollIntoView({ block: "nearest" }));
    },
  });

  const focusField = (name: string) => {
    requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`[name="${name}"], [data-field="${name}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "nearest" });
      (el.matches("input, select, textarea, button") ? el : el.querySelector<HTMLElement>("input, select, textarea, button"))?.focus({ preventScroll: true });
    });
  };

  const set = useCallback(<K extends keyof V & string>(name: K, value: V[K]) => {
    setValues((v) => (Object.is(v[name], value) ? v : { ...v, [name]: value }));
    setServerErrors((e) => {
      if (!(name in e)) return e;
      const next = { ...e };
      delete next[name];
      return next;
    });
  }, []);

  const setMany = useCallback((patch: Partial<V>) => {
    setValues((v) => ({ ...v, ...patch }));
    setServerErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  }, []);

  /** Replace values and treat them as saved (e.g. after a fresh load). */
  const reset = useCallback((next: V) => {
    setValues(next);
    setBaseline(JSON.stringify(next));
    setAttempted(false);
    setTouched(new Set());
    setServerErrors({});
    setFormError(null);
  }, []);

  /** Message to show under a field: server issues always; client issues after a submit attempt or once a filled field is left. */
  const error = (name: string): string | undefined => {
    if (serverErrors[name]) return serverErrors[name];
    const msg = clientErrors[name];
    if (!msg) return undefined;
    if (attempted) return msg;
    return touched.has(name) && !isBlank(values[name as keyof V]) ? msg : undefined;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    // Forms in nested dialogs are portaled but React events still bubble to the outer form — stop here.
    e?.stopPropagation();
    if (mutation.loading) return;
    setAttempted(true);
    setFormError(null);
    const errs = validate(values);
    const first = Object.keys(errs)[0];
    if (first) {
      if (first === "_form") setFormError(errs._form);
      focusField(first);
      return;
    }
    await mutation.run(bodyOf(values), values);
  };

  const fieldOf = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return el?.getAttribute?.("name") ?? el?.closest<HTMLElement>("[data-field]")?.dataset.field ?? null;
  };

  const bodyProps = {
    ref: bodyRef,
    onFocusCapture: (e: FocusEvent<HTMLDivElement>) => {
      const f = fieldOf(e.target);
      setFocused(f);
      latest.current.onFocusField?.(f);
    },
    onBlurCapture: (e: FocusEvent<HTMLDivElement>) => {
      const f = fieldOf(e.target);
      if (f) setTouched((t) => (t.has(f) ? t : new Set(t).add(f)));
      // Focus moving to the next field fires focus right after blur — only clear when it really left the form.
      window.setTimeout(() => {
        if (bodyRef.current && !bodyRef.current.contains(document.activeElement)) {
          setFocused(null);
          latest.current.onFocusField?.(null);
        }
      }, 0);
    },
  };

  // ---- bindings for the UI kit controls
  const text = <K extends keyof V & string>(name: K) => ({
    name,
    value: (values[name] ?? "") as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(name, e.target.value as V[K]),
  });
  const select = text;
  // The live hint row under number / date inputs gives way to the error message, so the error sits right under the box.
  const number = <K extends keyof V & string>(name: K) => ({
    name,
    value: values[name] as number | null,
    onValueChange: (n: number | null) => set(name, n as V[K]),
    hideHint: error(name) ? true : undefined,
  });
  const date = <K extends keyof V & string>(name: K) => ({
    name,
    value: (values[name] ?? "") as string,
    onValueChange: (s: string) => set(name, s as V[K]),
    hideHint: error(name) ? true : undefined,
  });

  return {
    values,
    set,
    setMany,
    reset,
    error,
    /** Every current client-side problem (not only the visible ones). */
    issues: clientErrors,
    formError,
    setFormError,
    busy: mutation.loading,
    dirty,
    attempted,
    focused,
    handleSubmit,
    bodyProps,
    text,
    select,
    number,
    date,
  };
}

export type FormApi<V extends Record<string, unknown>> = ReturnType<typeof useForm<V>>;
