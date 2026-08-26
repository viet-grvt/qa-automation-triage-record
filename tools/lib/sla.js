/**
 * sla.js — the "triaged within 1 business day" clock from QE-964.
 *
 * The unit the ticket measures is a **red run**, not a test and not a day: every red run must have
 * a threaded classification reply within one business day of being posted, and the acceptance
 * criterion is three consecutive weeks of that with zero stragglers at each weekly checkpoint.
 *
 * Business days are Mon–Fri in the configured timezone. A run posted on Friday evening is due end
 * of Monday, not Saturday — getting that wrong would either raise false alarms every weekend or
 * quietly forgive a real miss.
 */

/** Calendar date (YYYY-MM-DD) and weekday of an ISO timestamp, read in the given timezone. */
export function localParts(iso, tz) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday };
}

const WEEKEND = new Set(["Sat", "Sun"]);

/** Add n calendar days to a YYYY-MM-DD string. */
function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "short" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/**
 * The date the triage is due: the end of the next business day after the run was posted.
 * A run posted on a weekend is treated as arriving on the following Monday.
 */
export function dueDate(iso, tz) {
  // "Within 1 business day of posting" = the end of the first business day after the day it was
  // posted. A Friday or weekend run is therefore due Monday — not Saturday, and not Tuesday.
  let d = addDays(localParts(iso, tz).date, 1);
  while (WEEKEND.has(weekdayOf(d))) d = addDays(d, 1);
  return d;
}

/** Business days elapsed between two calendar dates, counting neither endpoint twice. */
export function businessDaysBetween(from, to) {
  if (!from || !to) return null;
  let n = 0;
  let d = from;
  while (d < to) {
    d = addDays(d, 1);
    if (!WEEKEND.has(weekdayOf(d))) n++;
  }
  return n;
}

/**
 * Where one red run stands against the clock.
 *   status: "triaged-on-time" | "triaged-late" | "due" | "overdue"
 */
export function slaStatus(run, entry, tz, todayDate) {
  const posted = localParts(run.iso, tz).date;
  const due = dueDate(run.iso, tz);
  if (entry?.triagedIso) {
    const done = localParts(entry.triagedIso, tz).date;
    return {
      status: done <= due ? "triaged-on-time" : "triaged-late",
      posted,
      due,
      done,
      lateBy: done <= due ? 0 : businessDaysBetween(due, done),
    };
  }
  return {
    status: todayDate > due ? "overdue" : "due",
    posted,
    due,
    done: null,
    lateBy: todayDate > due ? businessDaysBetween(due, todayDate) : 0,
  };
}

/** Stable key for a run in the triage log. runId is absent on some mobile posts, so fall back. */
export function runKey(run) {
  return run.runId ? `run:${run.runId}` : `ts:${run.channelKey}:${run.ts}`;
}

/** Monday of the ISO week a date falls in — the weekly checkpoint the acceptance criteria use. */
export function weekStart(date) {
  let d = date;
  while (weekdayOf(d) !== "Mon") d = addDays(d, -1);
  return d;
}

/** Is this calendar date a working day? Triage is expected Mon–Fri only. */
export function isBusinessDay(date) {
  return !WEEKEND.has(weekdayOf(date));
}
