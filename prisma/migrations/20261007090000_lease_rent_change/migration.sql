-- Rent changes on a lease (owner, 7/10/2026): from effective_from (1st of a month) the lease expects monthly_rent.
-- lease.monthly_rent stays the starting rent.
CREATE TABLE "lease_rent_change" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "monthly_rent" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lease_rent_change_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lease_rent_change_lease_id_effective_from_key" ON "lease_rent_change"("lease_id", "effective_from");
ALTER TABLE "lease_rent_change" ADD CONSTRAINT "lease_rent_change_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
