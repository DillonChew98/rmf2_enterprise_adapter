// Render an RFC3339 UTC timestamp in the configured display timezone,
// e.g. "2026-05-06 16:17:23 SGT" for Asia/Singapore. Timezone comes from
// VITE_DISPLAY_TIMEZONE (anything Intl accepts), defaulting to Asia/Singapore.

const DEFAULT_TZ = "Asia/Singapore";

const TIMEZONE: string =
  (import.meta.env.VITE_DISPLAY_TIMEZONE as string | undefined)?.trim() ||
  DEFAULT_TZ;

const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

export function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso; // degrade gracefully
  const parts = Object.fromEntries(
    FORMATTER.formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}
