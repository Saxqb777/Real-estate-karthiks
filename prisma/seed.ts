import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEFAULT_CATEGORIES = [
  { name: "Maintenance", color: "#4F9DFF" },
  { name: "Professional Fees", color: "#A78BFA" },
  { name: "Renovation", color: "#F59E0B" },
  { name: "Utilities", color: "#22C55E" },
  { name: "Property Tax", color: "#EF4444" },
  { name: "Unrecovered Dues", color: "#EC4899" },
];

async function main() {
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.plot.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: c.name },
      update: { isDefault: true },
      create: { ...c, isDefault: true },
    });
  }
  console.log("Seeded settings, plot and", DEFAULT_CATEGORIES.length, "default expense categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
