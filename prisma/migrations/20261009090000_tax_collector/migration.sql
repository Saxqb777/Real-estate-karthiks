-- Tax collector (owner, 9/10/2026): the municipal tax collector's name and phone, shown in the tax collector window
-- (the moped on the grass right of the plot) with call / WhatsApp buttons.
ALTER TABLE "settings" ADD COLUMN "tax_collector_name" TEXT;
ALTER TABLE "settings" ADD COLUMN "tax_collector_phone" TEXT;
