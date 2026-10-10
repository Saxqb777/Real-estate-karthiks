-- Bank / UPI reference (UTR or UPI Ref No.) on rent payments (owner, 10/10/2026)
ALTER TABLE "payment" ADD COLUMN "reference" TEXT;
