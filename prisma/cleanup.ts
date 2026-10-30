import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run cleanup in production.");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("Deleting all data (respecting FK order)...\n");

  const counts: Record<string, number> = {};

  counts.invoice = (await prisma.invoice.deleteMany()).count;
  console.log(`  Invoices:       ${counts.invoice}`);

  counts.notification = (await prisma.notification.deleteMany()).count;
  console.log(`  Notifications:  ${counts.notification}`);

  counts.review = (await prisma.review.deleteMany()).count;
  console.log(`  Reviews:        ${counts.review}`);

  counts.payment = (await prisma.payment.deleteMany()).count;
  console.log(`  Payments:       ${counts.payment}`);

  counts.orderItem = (await prisma.orderItem.deleteMany()).count;
  console.log(`  Order Items:    ${counts.orderItem}`);

  counts.order = (await prisma.order.deleteMany()).count;
  console.log(`  Orders:         ${counts.order}`);

  counts.offer = (await prisma.offer.deleteMany()).count;
  console.log(`  Offers:         ${counts.offer}`);

  counts.addon = (await prisma.addon.deleteMany()).count;
  console.log(`  Addons:         ${counts.addon}`);

  counts.variant = (await prisma.variant.deleteMany()).count;
  console.log(`  Variants:       ${counts.variant}`);

  counts.menuItem = (await prisma.menuItem.deleteMany()).count;
  console.log(`  Menu Items:     ${counts.menuItem}`);

  counts.category = (await prisma.category.deleteMany()).count;
  console.log(`  Categories:     ${counts.category}`);

  counts.table = (await prisma.table.deleteMany()).count;
  console.log(`  Tables:         ${counts.table}`);

  counts.adminUser = (await prisma.adminUser.deleteMany()).count;
  console.log(`  Admin Users:    ${counts.adminUser}`);

  counts.settings = (await prisma.settings.deleteMany()).count;
  console.log(`  Settings:       ${counts.settings}`);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nDone. ${total} records deleted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
