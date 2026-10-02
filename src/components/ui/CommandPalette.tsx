"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { useFocusTrap, useIsClient, useScrollLock } from "./hooks";
import { Kbd } from "./Kbd";
import styles from "./CommandPalette.module.css";

export interface Command {
  id: string;
  title: string;
  /** Section heading, e.g. "Actions", "Go to", "Account". */
  group?: string;
  subtitle?: string;
  /** Extra words that should match (synonyms, Tamil/English names, …). */
  keywords?: string[];
  icon?: ReactNode;
  /** Navigate here when chosen. */
  href?: string;
  /** Run when chosen (after the palette closes). */
  perform?: () => void | Promise<void>;
}

interface CommandContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  register: (sourceId: string, getter: () => Command[]) => () => void;
  getCommands: () => Command[];
}

const CommandContext = createContext<CommandContextValue | null>(null);

/** Open/close the palette from anywhere inside <CommandProvider>. */
export function useCommandPalette() {
  const ctx = useContext(CommandContext);
  return {
    open: ctx?.open ?? false,
    setOpen: ctx?.setOpen ?? (() => {}),
    toggle: ctx?.toggle ?? (() => {}),
  };
}

/**
 * Register page-specific commands while the calling component is mounted:
 *   useRegisterCommands([{ id: "pay", group: "Actions", title: "Record payment", perform: () => setOpen(true) }]);
 * The latest array is read whenever the palette opens, so it is fine to pass a fresh array each render.
 */
export function useRegisterCommands(commands: Command[]) {
  const ctx = useContext(CommandContext);
  const ref = useRef(commands);
  const id = useId();
  useEffect(() => {
    ref.current = commands;
  });
  const register = ctx?.register;
  useEffect(() => register?.(id, () => ref.current), [register, id]);
}

export interface CommandProviderProps {
  children: ReactNode;
  /** Always-available commands (navigation, logout, …). */
  defaults?: Command[];
}

/** Holds the command registry, binds Ctrl/⌘K, and renders the palette. */
export function CommandProvider({ children, defaults = [] }: CommandProviderProps) {
  const [open, setOpen] = useState(false);
  const sources = useRef(new Map<string, () => Command[]>());
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  });

  const register = useCallback((sourceId: string, getter: () => Command[]) => {
    sources.current.set(sourceId, getter);
    return () => {
      sources.current.delete(sourceId);
    };
  }, []);
  const getCommands = useCallback(() => {
    const seen = new Set<string>();
    return [...[...sources.current.values()].flatMap((g) => g()), ...defaultsRef.current].filter((c) =>
      seen.has(c.id) ? false : (seen.add(c.id), true),
    );
  }, []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open, setOpen, toggle, register, getCommands }), [open, toggle, register, getCommands]);
  return (
    <CommandContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandContext.Provider>
  );
}

// ---------------------------------------------------------------- fuzzy matching

export interface FuzzyResult {
  score: number;
  indices: number[];
}

const isWordStart = (t: string, i: number) => i === 0 || /[\s\-_/·(.,]/.test(t[i - 1]);

/** Subsequence fuzzy match with bonuses for substrings, word starts and consecutive runs. */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const sub = t.indexOf(q);
  if (sub >= 0) {
    return {
      score: 100 + (sub === 0 ? 40 : isWordStart(t, sub) ? 20 : 0) - sub * 0.3 - (t.length - q.length) * 0.05,
      indices: Array.from({ length: q.length }, (_, i) => sub + i),
    };
  }
  const chars = q.replace(/\s+/g, "");
  let from = 0;
  let prev = -2;
  let score = 0;
  const indices: number[] = [];
  for (const ch of chars) {
    const found = t.indexOf(ch, from);
    if (found < 0) return null;
    score += 1 + (found === prev + 1 ? 4 : 0) + (isWordStart(t, found) ? 6 : 0) - (found - from) * 0.12;
    indices.push(found);
    prev = found;
    from = found + 1;
  }
  return { score, indices };
}

const GROUP_ORDER: Record<string, number> = { Actions: 10, "Go to": 20, Navigate: 20, Account: 90 };

interface Row {
  cmd: Command;
  score: number;
  indices: number[];
}

function filterCommands(commands: Command[], query: string): { group: string; rows: Row[] }[] {
  const rows: Row[] = [];
  for (const cmd of commands) {
    if (!query.trim()) {
      rows.push({ cmd, score: 0, indices: [] });
      continue;
    }
    const title = fuzzyMatch(query, cmd.title);
    const extra = [cmd.subtitle, cmd.group, ...(cmd.keywords ?? [])]
      .filter(Boolean)
      .map((s) => fuzzyMatch(query, s!))
      .reduce<number>((best, r) => Math.max(best, r ? r.score * 0.7 : -Infinity), -Infinity);
    const score = Math.max(title?.score ?? -Infinity, extra);
    if (score > -Infinity) rows.push({ cmd, score, indices: title && title.score >= extra ? title.indices : [] });
  }
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const g = r.cmd.group ?? "Commands";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  const out = [...groups.entries()].map(([group, rs]) => ({ group, rows: query.trim() ? rs.sort((a, b) => b.score - a.score) : rs }));
  return out.sort((a, b) =>
    query.trim() ? b.rows[0].score - a.rows[0].score : (GROUP_ORDER[a.group] ?? 50) - (GROUP_ORDER[b.group] ?? 50),
  );
}

function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>;
  const set = new Set(indices);
  return (
    <>
      {text.split("").map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : <span key={i}>{ch}</span>))}
    </>
  );
}

// ---------------------------------------------------------------- palette UI

function CommandPalette() {
  const ctx = useContext(CommandContext)!;
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => ctx.setOpen(false), [ctx]);
  useFocusTrap(ref, ctx.open && isClient, close);
  useScrollLock(ctx.open && isClient);
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {ctx.open && (
        <>
          <motion.div
            key="bd"
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden
          />
          <div key="layer" className={styles.layer} onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <motion.div
              ref={ref}
              className={styles.palette}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              tabIndex={-1}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <PaletteBody commands={ctx.getCommands()} onClose={close} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PaletteBody({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const router = useRouter();
  const uid = useId().replace(/:/g, "");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => filterCommands(commands, query), [commands, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.cmd)), [groups]);
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    if (cmd.href) router.push(cmd.href);
    void cmd.perform?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    if (!n) return;
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      setActive((activeIndex + 1) % n);
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      setActive((activeIndex - 1 + n) % n);
    } else if (e.key === "Home" && e.ctrlKey) {
      setActive(0);
    } else if (e.key === "End" && e.ctrlKey) {
      setActive(n - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(flat[activeIndex]);
    }
  };

  let index = -1;
  return (
    <>
      <div className={styles.search}>
        <Search aria-hidden />
        <input
          className={styles.input}
          data-autofocus
          role="combobox"
          aria-expanded="true"
          aria-controls={`${uid}-list`}
          aria-activedescendant={flat.length ? `${uid}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          placeholder="Search commands, pages…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div ref={listRef} id={`${uid}-list`} role="listbox" aria-label="Commands" className={styles.list}>
        {flat.length === 0 && (
          <p className={styles.empty}>
            Nothing matches <b>“{query}”</b>. Try “pay”, “expense” or “config”.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.group} role="group" aria-labelledby={`${uid}-g-${g.group}`} className={styles.group}>
            <div id={`${uid}-g-${g.group}`} className={styles.groupLabel}>
              {g.group}
            </div>
            {g.rows.map(({ cmd, indices }) => {
              index++;
              const i = index;
              const isActive = i === activeIndex;
              return (
                <div
                  key={cmd.id}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  data-index={i}
                  className={cx(styles.item, isActive && styles.active)}
                  onMouseMove={() => i !== activeIndex && setActive(i)}
                  onClick={() => run(cmd)}
                >
                  {isActive && <motion.span layoutId={`${uid}-rail`} className={styles.rail} transition={{ type: "spring", stiffness: 700, damping: 45 }} />}
                  <span className={styles.itemIcon} aria-hidden>
                    {cmd.icon}
                  </span>
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>
                      <Highlight text={cmd.title} indices={indices} />
                    </span>
                    {cmd.subtitle && <span className={styles.itemSub}>{cmd.subtitle}</span>}
                  </span>
                  <span className={styles.enter} aria-hidden>
                    <CornerDownLeft />
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <span>
          <Kbd keys={["up"]} />
          <Kbd keys={["down"]} />
          navigate
        </span>
        <span>
          <Kbd keys={["enter"]} />
          open
        </span>
        <span className={styles.hideSm}>
          <Kbd keys={["mod", "k"]} />
          toggle
        </span>
        <span className={styles.count}>
          {flat.length} {flat.length === 1 ? "command" : "commands"}
        </span>
      </div>
    </>
  );
}
