// The list behind a "type it or pick it" box (to-do Kind, unit Type): the usual choices first, then the ones already
// used in the owner's records that aren't among them (so a kind typed once, e.g. "Renovation", can be picked again),
// with an optional catch-all (e.g. "Custom") kept last. Same word in another case = the same choice.
export function kindChoices(usual: readonly string[], used: readonly (string | null | undefined)[], last?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = (s ?? "").trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k) || (last && k === last.toLowerCase())) return;
    seen.add(k);
    out.push(t);
  };
  usual.forEach(add);
  [...used].map((s) => (s ?? "").trim()).sort((a, b) => a.localeCompare(b)).forEach(add);
  if (last) out.push(last);
  return out;
}
