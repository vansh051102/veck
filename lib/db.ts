import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Query logging floods the terminal and makes every request look "stuck".
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

export async function healthCheck() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok' }
  } catch (error) {
    console.error('Health check failed:', error)
    return { status: 'error', message: 'Database connection failed' }
  }
}

export async function disconnect() {
  await prisma.$disconnect()
}
