// Tiny className joiner (no dependency).
export type ClassValue = string | false | null | undefined | 0;

export function cx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
