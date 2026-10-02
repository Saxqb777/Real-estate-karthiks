-- CreateEnum
CREATE TYPE "Position" AS ENUM ('front', 'back');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank', 'upi', 'other');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('Paid', 'Due');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High');

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "brand_name" TEXT NOT NULL DEFAULT 'Pattukottai Estates',
    "subtitle" TEXT,
    "owner_email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "date_format" TEXT NOT NULL DEFAULT 'D/M/YYYY',
    "rent_due_day" INTEGER NOT NULL DEFAULT 1,
    "late_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "late_fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "late_fee_grace_days" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "front_width_ft" DECIMAL(8,2),
    "back_width_ft" DECIMAL(8,2),
    "depth_ft" DECIMAL(8,2),
    "area_sqft" DECIMAL(10,2),
    "site_plan_image_url" TEXT,
    "town_name" TEXT NOT NULL DEFAULT 'Pattukottai',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Townhouse',
    "address" TEXT,
    "floors" INTEGER NOT NULL DEFAULT 1,
    "built_up_sqft" DECIMAL(10,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "purchase_price" DECIMAL(14,2) NOT NULL,
    "annual_appreciation_rate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "electricity_consumer_number" TEXT,
    "electricity_pay_url" TEXT,
    "footprint_width_ft" DECIMAL(8,2),
    "footprint_depth_ft" DECIMAL(8,2),
    "position" "Position",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "offer_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "id_proof_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "monthly_rent" DECIMAL(14,2) NOT NULL,
    "security_deposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deposit_refunded_amount" DECIMAL(14,2),
    "deposit_refund_date" DATE,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "move_out_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "invoice_seq" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B93A7',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT,
    "category_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_tax" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_date" DATE,
    "status" "TaxStatus" NOT NULL DEFAULT 'Due',
    "expense_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Custom',
    "priority" "Priority" NOT NULL DEFAULT 'Medium',
    "due_date" DATE,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMP(3),
    "unit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_unit_id_idx" ON "offer"("unit_id");

-- CreateIndex
CREATE INDEX "lease_unit_id_idx" ON "lease"("unit_id");

-- CreateIndex
CREATE INDEX "lease_tenant_id_idx" ON "lease"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_invoice_seq_key" ON "payment"("invoice_seq");

-- CreateIndex
CREATE UNIQUE INDEX "payment_invoice_number_key" ON "payment"("invoice_number");

-- CreateIndex
CREATE INDEX "payment_lease_id_idx" ON "payment"("lease_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_category_name_key" ON "expense_category"("name");

-- CreateIndex
CREATE INDEX "expense_unit_id_idx" ON "expense"("unit_id");

-- CreateIndex
CREATE INDEX "expense_category_id_idx" ON "expense"("category_id");

-- CreateIndex
CREATE INDEX "expense_expense_date_idx" ON "expense"("expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "property_tax_expense_id_key" ON "property_tax"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_tax_unit_id_year_key" ON "property_tax"("unit_id", "year");

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease" ADD CONSTRAINT "lease_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease" ADD CONSTRAINT "lease_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_tax" ADD CONSTRAINT "property_tax_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_tax" ADD CONSTRAINT "property_tax_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
