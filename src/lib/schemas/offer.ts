// Offers (purchase offers received for a unit): zod schemas for /api/offers + response type. Safe to import in the UI.
import { z } from "zod";
import "./messages";
import { zId, zPositiveMoney, zText } from "@/lib/validation";
import { zPastDate, zRequired } from "@/lib/validation";

export type { OfferDTO } from "./unit";

const offerFields = {
  unitId: zRequired(zId),
  amount: zRequired(zPositiveMoney),
  offerDate: zRequired(zPastDate),
  notes: zText(1000),
};

/** POST /api/offers */
export const offerCreateSchema = z.object(offerFields);

/** PUT /api/offers/[id]: partial (the unit cannot be changed). */
export const offerUpdateSchema = z.object({ amount: offerFields.amount, offerDate: offerFields.offerDate, notes: offerFields.notes }).partial();

/** GET /api/offers?unitId=… (unitId is required). */
export const offerListQuerySchema = z.object({ unitId: zRequired(zId, "is required, e.g. /api/offers?unitId=<unit id>") });

export type OfferCreate = z.output<typeof offerCreateSchema>;
export type OfferUpdate = z.output<typeof offerUpdateSchema>;
