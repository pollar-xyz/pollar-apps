/**
 * The restaurant's day, not the server's.
 *
 * Timestamps are stored in UTC, but "today's orders" has to mean today where
 * the food is sold. On a UTC server, a naive `new Date().setHours(0,0,0,0)`
 * would roll the daily summary over at 20:00 Bolivian time — mid-dinner, with
 * the owner watching the total reset to zero.
 */
export const RESTAURANT_TZ = "America/La_Paz";

/** How far the zone is from UTC at that instant, in milliseconds. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUtc - at.getTime();
}

/** The instant local midnight happened, as a UTC Date. */
export function startOfDayIn(timeZone: string, at: Date = new Date()): Date {
  const offset = zoneOffsetMs(timeZone, at);
  const local = new Date(at.getTime() + offset);
  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );
  return new Date(localMidnight - offset);
}

export function startOfToday(at: Date = new Date()): Date {
  return startOfDayIn(RESTAURANT_TZ, at);
}

/** "14:05" in the restaurant's zone. */
export function formatTime(at: Date): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: RESTAURANT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

export function formatDateTime(at: Date): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: RESTAURANT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
