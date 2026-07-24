/**
 * Timezone-aware day-boundary math. "Next 2 days" etc. must resolve against
 * the org's wall-clock, not the server's UTC clock, or a lead due tomorrow
 * morning IST can fall on the wrong side of midnight UTC.
 */

/** The real UTC instant that is midnight at the start of `date`'s calendar day in `timeZone`. */
export function zonedStartOfDay(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)

  // Reading `date`'s wall-clock fields in `timeZone`, then re-interpreting
  // them as UTC gives the offset between the two at this instant.
  const wallClockAsIfUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const offsetMs = wallClockAsIfUTC - date.getTime()

  const startOfDayAsIfUTC = Date.UTC(get('year'), get('month') - 1, get('day'), 0, 0, 0)
  return new Date(startOfDayAsIfUTC - offsetMs)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}
