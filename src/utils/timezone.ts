/** Formats a date as YYYY-MM-DD in the given IANA time zone. */
export function toDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Offset (ms) of `timeZone` from UTC at the given instant, e.g. +6h for Asia/Dhaka. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the local day containing `date` starts in `timeZone`. */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const utcMidnight = Date.parse(`${toDayKey(date, timeZone)}T00:00:00Z`);
  return new Date(utcMidnight - getTimeZoneOffsetMs(new Date(utcMidnight), timeZone));
}
