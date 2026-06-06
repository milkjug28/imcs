// Trait burn-for-IQ rules. Shared by the burn API routes.

export const WEEKLY_BURN_CAP = 50 // max traits a wallet can burn per week
export const IQ_PER_BURN = 5 // IQ credited per trait burned

// Start of the current burn week: most recent Sunday 00:00 UTC.
// getUTCDay() returns 0 for Sunday, so subtracting it lands on Sunday.
export function weekStartUTC(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}

export function weekResetsAt(now: Date = new Date()): Date {
  const start = weekStartUTC(now)
  start.setUTCDate(start.getUTCDate() + 7)
  return start
}
