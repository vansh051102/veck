// Single source of truth for SLA timing. Replaces lib/workflow.ts:calculateSlaDeadline/
// isSlaBreached and the duplicate call site in quotes/[id]/send. Generic over
// entityType+entityId so future departments (Dispatch, Accounts, ...) reuse this
// without schema changes — only "Lead" is wired up today.
import type { Prisma, PrismaClient, BusinessCalendar } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

type DayWindow = { start: string; end: string } // "HH:MM"
type WorkingHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayWindow | null>>

interface BusinessCalendarLike {
  timezone: string
  workingHours: WorkingHours
  holidays: string[]
  halfDays?: Record<string, DayWindow> | null
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function toCalendarLike(cal: BusinessCalendar | null | undefined): BusinessCalendarLike | null {
  if (!cal) return null
  return {
    timezone: cal.timezone,
    workingHours: (cal.workingHours ?? {}) as WorkingHours,
    holidays: cal.holidays,
    halfDays: (cal.halfDays as Record<string, DayWindow> | null) ?? null,
  }
}

function toMinutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Adds `minutes` of business time to `start`, respecting the calendar's working
 * hours/holidays/half-days. Falls back to naive wall-clock addition when no
 * calendar is configured (today's behavior — safe default, zero regression).
 */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  calendar?: BusinessCalendarLike | null
): Date {
  if (!calendar) return new Date(start.getTime() + minutes * 60_000)

  let remaining = minutes
  let cursor = new Date(start)

  // ponytail: day-walk loop, capped at 3 years of days as a runaway guard
  for (let i = 0; i < 365 * 3 && remaining > 0; i++) {
    const dateKey = isoDate(cursor)
    const dayKey = DAY_KEYS[cursor.getUTCDay()]
    const window = calendar.holidays.includes(dateKey)
      ? null
      : calendar.halfDays?.[dateKey] ?? calendar.workingHours[dayKey]

    if (window) {
      const windowStartMin = toMinutesOfDay(window.start)
      const windowEndMin = toMinutesOfDay(window.end)
      const dayStart = new Date(cursor)
      dayStart.setUTCHours(0, 0, 0, 0)
      const cursorMin = Math.max(
        (cursor.getTime() - dayStart.getTime()) / 60_000,
        windowStartMin
      )
      const availableMin = windowEndMin - cursorMin
      if (availableMin > 0) {
        const consume = Math.min(availableMin, remaining)
        cursor = new Date(dayStart.getTime() + (cursorMin + consume) * 60_000)
        remaining -= consume
        if (remaining <= 0) break
      }
    }

    // advance to next day's window start
    const nextDay = new Date(cursor)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)
    nextDay.setUTCHours(0, 0, 0, 0)
    cursor = nextDay
  }

  return cursor
}

/** Inverse of addBusinessMinutes — business minutes elapsed between two timestamps. */
export function elapsedBusinessMinutes(
  start: Date,
  end: Date,
  calendar?: BusinessCalendarLike | null
): number {
  if (!calendar) return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))

  let total = 0
  let cursor = new Date(start)

  for (let i = 0; i < 365 * 3 && cursor < end; i++) {
    const dateKey = isoDate(cursor)
    const dayKey = DAY_KEYS[cursor.getUTCDay()]
    const window = calendar.holidays.includes(dateKey)
      ? null
      : calendar.halfDays?.[dateKey] ?? calendar.workingHours[dayKey]

    const dayStart = new Date(cursor)
    dayStart.setUTCHours(0, 0, 0, 0)
    const nextDay = new Date(dayStart)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)

    if (window) {
      const windowStart = new Date(dayStart.getTime() + toMinutesOfDay(window.start) * 60_000)
      const windowEnd = new Date(dayStart.getTime() + toMinutesOfDay(window.end) * 60_000)
      const overlapStart = cursor > windowStart ? cursor : windowStart
      const overlapEnd = end < windowEnd ? end : windowEnd
      if (overlapEnd > overlapStart) {
        total += (overlapEnd.getTime() - overlapStart.getTime()) / 60_000
      }
    }

    cursor = nextDay < end ? nextDay : end
  }

  return Math.round(total)
}

interface StartSlaClockOptions {
  db: Db
  orgId: string
  entityType: string
  entityId: string
  stage: string
  trigger: string
  department?: string | null
  startAt?: Date
  /** Fallback target when no SlaRule matches — today's Settings.workflowStages[stage].slaHours or DEFAULT_SLA_HOURS. */
  fallbackHours?: number | null
}

export interface SlaClockResult {
  clockId: string
  deadline: Date | null
  targetMinutes: number | null
}

/** Opens an SlaClock for a stage/trigger. Resolves SlaRule -> fallback hours; resolves BusinessCalendar. */
export async function startSlaClock(opts: StartSlaClockOptions): Promise<SlaClockResult> {
  const { db, orgId, entityType, entityId, stage, trigger, department, startAt = new Date() } =
    opts

  const rule = await db.slaRule.findFirst({
    where: {
      orgId,
      entityType,
      stage,
      trigger,
      isActive: true,
      OR: [{ department: department ?? undefined }, { department: null }],
    },
    orderBy: { department: 'desc' }, // department-specific rule wins over org-wide
    include: { calendar: true },
  })

  let targetMinutes: number | null = rule?.targetMinutes ?? null
  let calendar: BusinessCalendarLike | null = toCalendarLike(rule?.calendar)

  if (!rule && opts.fallbackHours != null) {
    targetMinutes = opts.fallbackHours * 60
  }

  if (!calendar) {
    const settings = await db.settings.findUnique({
      where: { orgId },
      select: { defaultCalendarId: true },
    })
    if (settings?.defaultCalendarId) {
      calendar = toCalendarLike(
        await db.businessCalendar.findUnique({
          where: { id: settings.defaultCalendarId },
        })
      )
    }
  }

  const deadline =
    targetMinutes != null ? addBusinessMinutes(startAt, targetMinutes, calendar) : null

  const clock = await db.slaClock.create({
    data: {
      orgId,
      entityType,
      entityId,
      ruleId: rule?.id,
      stage,
      trigger,
      startedAt: startAt,
      targetMinutes,
      deadline,
      status: 'pending',
    },
  })

  return { clockId: clock.id, deadline, targetMinutes }
}

/** Closes the currently-open (pending/overdue/escalated) clock(s) for an entity. */
export async function closeOpenSlaClocks(
  db: Db,
  entityType: string,
  entityId: string,
  endedAt: Date = new Date()
): Promise<void> {
  const openClocks = await db.slaClock.findMany({
    where: { entityType, entityId, status: { in: ['pending', 'overdue', 'escalated'] } },
  })

  for (const clock of openClocks) {
    const calendar = clock.ruleId
      ? await db.slaRule.findUnique({ where: { id: clock.ruleId }, include: { calendar: true } })
      : null
    await db.slaClock.update({
      where: { id: clock.id },
      data: {
        endedAt,
        status: 'completed',
        elapsedBusinessMinutes: elapsedBusinessMinutes(
          clock.startedAt,
          endedAt,
          toCalendarLike(calendar?.calendar)
        ),
      },
    })
  }
}

export function isSlaBreached(slaDeadline: Date, now: Date = new Date()): boolean {
  return now.getTime() > slaDeadline.getTime()
}
