const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const diffSeconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const absDiff = Math.abs(diffSeconds);

  for (const { unit, seconds } of UNITS) {
    if (absDiff >= seconds || unit === "second") {
      const value = Math.round(diffSeconds / seconds);
      return rtf.format(value, unit);
    }
  }
  return rtf.format(0, "second");
}
