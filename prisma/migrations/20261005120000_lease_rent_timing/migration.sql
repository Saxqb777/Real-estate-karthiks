-- Per-lease rent timing (owner, 5/10/2026): "advance" = a month's rent is due in that month; "arrears" = due in the
-- following month. rent_due_day overrides Settings.rentDueDay for the lease.
ALTER TABLE "lease" ADD COLUMN "rent_timing" TEXT NOT NULL DEFAULT 'advance';
ALTER TABLE "lease" ADD COLUMN "rent_due_day" INTEGER;
