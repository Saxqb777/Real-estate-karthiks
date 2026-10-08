-- Rental agreement renewal (owner, 8/10/2026): the current agreement's end date on a lease (e.g. 11-month agreements)
-- and how many days before it the app reminds the owner.
ALTER TABLE "lease" ADD COLUMN "agreement_end_date" DATE;
ALTER TABLE "settings" ADD COLUMN "renewal_reminder_days" INTEGER NOT NULL DEFAULT 30;
