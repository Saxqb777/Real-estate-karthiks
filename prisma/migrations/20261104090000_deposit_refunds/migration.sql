-- Deposit refunds (owner, 4/11/2026): a lease can have several refunds, each with its own date, ref no. (UTR) and files.
-- The one refund each lease held so far (lease.deposit_refunded_amount / deposit_refund_date) is copied in; ₹0 = the
-- whole deposit kept. The old columns stay (no longer read) as a record of what was there.

-- CreateTable
CREATE TABLE "deposit_refund" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "refund_date" DATE NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deposit_refund_lease_id_idx" ON "deposit_refund"("lease_id");

-- AddForeignKey
ALTER TABLE "deposit_refund" ADD CONSTRAINT "deposit_refund_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- the refund each lease already had (dated its refund date, else the last day of tenancy, else the start)
INSERT INTO "deposit_refund" ("id", "lease_id", "amount", "refund_date", "created_at", "updated_at")
SELECT 'rf_' || "id", "id", "deposit_refunded_amount", COALESCE("deposit_refund_date", "end_date", "start_date"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "lease"
WHERE "deposit_refunded_amount" IS NOT NULL;

-- AlterTable
ALTER TABLE "attachment" ADD COLUMN "deposit_refund_id" TEXT;

-- CreateIndex
CREATE INDEX "attachment_deposit_refund_id_idx" ON "attachment"("deposit_refund_id");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_deposit_refund_id_fkey" FOREIGN KEY ("deposit_refund_id") REFERENCES "deposit_refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- every file still belongs to exactly one record (now one of five)
ALTER TABLE "attachment" DROP CONSTRAINT "attachment_one_owner";
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_one_owner" CHECK (num_nonnulls("payment_id", "expense_id", "lease_id", "property_tax_id", "deposit_refund_id") = 1);
