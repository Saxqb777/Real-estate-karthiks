// Tenant input schemas (shared by /api/tenants and the UI forms).
import type { Tenant } from "@prisma/client";
import { z } from "zod";
import "./messages";
import { zEmailOrNull, zRequiredText, zText } from "@/lib/validation";
import type { LeaseDTO, LeaseStats } from "./lease";
import type { Serialized } from "@/lib/types";

/**
 * Optional Indian phone number: digits with an optional leading "+" (e.g. +91), spaces and dashes,
 * 10–15 digits in total. "" / whitespace → null. Stored as typed (trimmed, single spaces).
 */
export const zPhoneOrNull = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim().replace(/\s+/g, " ")) : v === undefined ? null : v),
  z
    .string({ message: "must be text" })
    .superRefine((s, ctx) => {
      const digits = s.replace(/\D/g, "").length;
      if (!/^\+?[\d\s-]+$/.test(s)) {
        ctx.addIssue({ code: "custom", message: "may contain only digits, spaces, dashes and a leading +" });
      } else if (digits < 10 || digits > 15) {
        ctx.addIssue({ code: "custom", message: "must have 10–15 digits (e.g. 98765 43210 or +91 98765 43210)" });
      }
    })
    .nullable(),
);

const tenantFields = {
  name: zRequiredText("Name", 120),
  phone: zPhoneOrNull,
  email: zEmailOrNull,
  idProofRef: zText(200),
};

export const tenantCreateSchema = z.object(tenantFields);
/** Partial update: only provided fields change. */
export const tenantUpdateSchema = z.object(tenantFields).partial();

export type TenantCreateInput = z.input<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.input<typeof tenantUpdateSchema>;

// ---- Response types (JSON as returned by the API) ------------------------------------------------

export type TenantDTO = Serialized<Tenant>;

export interface TenantActiveLease {
  id: string;
  unitId: string;
  unitName: string;
  startDate: string;
  monthlyRent: number;
}

/** GET /api/tenants → { items: TenantListItem[] }; POST /api/tenants → TenantListItem */
export type TenantListItem = TenantDTO & { leasesCount: number; activeLease: TenantActiveLease | null };

/** GET / PUT /api/tenants/[id]. Leases: active first, then newest. */
export type TenantDetail = TenantListItem & {
  leases: (LeaseDTO & LeaseStats & { unit: { id: string; name: string; position: "front" | "back" | null } })[];
  paymentsTotal: number;
};
