-- Proof files (owner, 10/10/2026): photos, screenshots and PDFs attached to a rent payment, an expense, a lease's security
-- deposit or a property tax year (exactly one of them), plus the deposit transfer's ref no. (UTR) on the lease.

-- AlterTable
ALTER TABLE "lease" ADD COLUMN     "deposit_reference" TEXT;

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT,
    "expense_id" TEXT,
    "lease_id" TEXT,
    "property_tax_id" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "file_key" TEXT NOT NULL,
    "thumb_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachment_file_key_key" ON "attachment"("file_key");

-- CreateIndex
CREATE INDEX "attachment_payment_id_idx" ON "attachment"("payment_id");

-- CreateIndex
CREATE INDEX "attachment_expense_id_idx" ON "attachment"("expense_id");

-- CreateIndex
CREATE INDEX "attachment_lease_id_idx" ON "attachment"("lease_id");

-- CreateIndex
CREATE INDEX "attachment_property_tax_id_idx" ON "attachment"("property_tax_id");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_property_tax_id_fkey" FOREIGN KEY ("property_tax_id") REFERENCES "property_tax"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- every file belongs to exactly one record
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_one_owner" CHECK (num_nonnulls("payment_id", "expense_id", "lease_id", "property_tax_id") = 1);
