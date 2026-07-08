jest.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: jest.fn() }, role: { findFirst: jest.fn() } },
}))
jest.mock('@/lib/logger', () => ({ createChildLogger: () => ({ error: jest.fn() }) }))

import { getUserPermissions } from '../rbac'
import { prisma } from '@/lib/db'

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock }
  role: { findFirst: jest.Mock }
}

describe('getUserPermissions', () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockReset()
    mockPrisma.role.findFirst.mockReset()
  })

  it('returns wildcard for admin without a role lookup', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin', orgId: 'o' })
    expect(await getUserPermissions('u')).toEqual(['*'])
    expect(mockPrisma.role.findFirst).not.toHaveBeenCalled()
  })

  it('returns the role permissions when the role exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'sales_executive', orgId: 'o' })
    mockPrisma.role.findFirst.mockResolvedValue({ permissions: ['leads:read', 'leads:edit'] })
    expect(await getUserPermissions('u')).toEqual(['leads:read', 'leads:edit'])
  })

  it('returns [] when the user has no matching role record', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ghost', orgId: 'o' })
    mockPrisma.role.findFirst.mockResolvedValue(null)
    expect(await getUserPermissions('u')).toEqual([])
  })

  it('returns [] when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect(await getUserPermissions('u')).toEqual([])
  })

  it('fails closed to [] on a DB error', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db down'))
    expect(await getUserPermissions('u')).toEqual([])
  })
})
