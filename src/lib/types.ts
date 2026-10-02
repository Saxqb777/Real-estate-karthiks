// Shared type helpers (type-only; safe anywhere).
import type { Prisma } from "@prisma/client";

/** JSON shape of a Prisma row after serialize(): Decimal → number, Date → ISO string. */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
