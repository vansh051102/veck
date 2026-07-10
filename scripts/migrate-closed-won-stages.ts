/**
 * One-time: rename legacy "Closed Won" leads → "Order Confirmed".
 * Run: npx tsx scripts/migrate-closed-won-stages.ts
 * (or via npm run if wired; requires DATABASE_URL)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.lead.updateMany({
    where: { stage: 'Closed Won' },
    data: { stage: 'Order Confirmed' },
  })
  console.log(`Updated ${result.count} lead(s) from Closed Won → Order Confirmed`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
