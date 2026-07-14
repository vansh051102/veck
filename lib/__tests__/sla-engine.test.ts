import { addBusinessMinutes, elapsedBusinessMinutes, isSlaBreached } from '../sla-engine'

const CALENDAR = {
  timezone: 'Asia/Kolkata',
  workingHours: {
    mon: { start: '09:30', end: '18:30' },
    tue: { start: '09:30', end: '18:30' },
    wed: { start: '09:30', end: '18:30' },
    thu: { start: '09:30', end: '18:30' },
    fri: { start: '09:30', end: '18:30' },
    sat: null,
    sun: null,
  },
  holidays: ['2026-08-15'],
  halfDays: { '2026-12-24': { start: '09:30', end: '14:00' } },
}

describe('addBusinessMinutes', () => {
  it('falls back to naive wall-clock when no calendar given', () => {
    const start = new Date('2026-07-13T03:00:00Z') // Monday
    expect(addBusinessMinutes(start, 60, null)).toEqual(new Date('2026-07-13T04:00:00Z'))
  })

  it('skips non-working hours — lead at 3AM only starts counting at 9:30AM office open', () => {
    // 2026-07-13 is a Monday. 3:00 IST = 21:30 UTC previous day; use UTC directly
    // as a stand-in "local" clock since the calendar's HH:MM windows are compared
    // against UTC wall-clock here (single-timezone org, no conversion needed).
    const leadReceived = new Date('2026-07-13T03:00:00Z')
    const oneHourSla = addBusinessMinutes(leadReceived, 60, CALENDAR)
    // Office opens 09:30 same day -> deadline should be 10:30, not 04:00
    expect(oneHourSla).toEqual(new Date('2026-07-13T10:30:00Z'))
  })

  it('skips weekends', () => {
    const fridayEvening = new Date('2026-07-17T17:30:00Z') // Friday, 1hr before close
    const deadline = addBusinessMinutes(fridayEvening, 120, CALENDAR) // needs 2h
    // 1h consumed Friday to 18:30, remaining 1h rolls to Monday 09:30-10:30
    expect(deadline).toEqual(new Date('2026-07-20T10:30:00Z'))
  })

  it('skips holidays', () => {
    const beforeHoliday = new Date('2026-08-14T17:30:00Z') // Friday, 1hr before close, holiday Sat is irrelevant (weekend anyway) — use a holiday on a weekday instead
    void beforeHoliday
    const thursdayBeforeHoliday = new Date('2026-08-13T17:30:00Z') // Thu
    const deadline = addBusinessMinutes(thursdayBeforeHoliday, 120, {
      ...CALENDAR,
      holidays: ['2026-08-14'], // Friday holiday
    })
    // 1h Thu to 18:30, Fri is holiday, remaining 1h rolls to Sat/Sun skipped -> Mon 09:30-10:30
    expect(deadline).toEqual(new Date('2026-08-17T10:30:00Z'))
  })
})

describe('elapsedBusinessMinutes', () => {
  it('is the inverse of addBusinessMinutes for a same-day window', () => {
    const start = new Date('2026-07-13T10:00:00Z')
    const end = new Date('2026-07-13T12:00:00Z')
    expect(elapsedBusinessMinutes(start, end, CALENDAR)).toBe(120)
  })

  it('returns 0 minutes elapsed entirely outside working hours', () => {
    const start = new Date('2026-07-13T00:00:00Z')
    const end = new Date('2026-07-13T03:00:00Z')
    expect(elapsedBusinessMinutes(start, end, CALENDAR)).toBe(0)
  })
})

describe('isSlaBreached', () => {
  it('flags breach after deadline', () => {
    const deadline = new Date('2026-07-13T10:00:00Z')
    expect(isSlaBreached(deadline, new Date('2026-07-13T11:00:00Z'))).toBe(true)
    expect(isSlaBreached(deadline, new Date('2026-07-13T09:00:00Z'))).toBe(false)
  })
})
