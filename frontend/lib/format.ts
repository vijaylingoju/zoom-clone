const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return DAY.format(date);
}

export function formatMeetingWindow(startIso: string, durationMinutes: number | null): string {
  const start = new Date(startIso);
  const parts = [`${formatDay(startIso)}, ${TIME.format(start)}`];
  if (durationMinutes) {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    parts.push(`– ${TIME.format(end)}`);
  }
  return parts.join(" ");
}

/** Accepts a raw meeting code or a full invite link and returns the code. */
export function parseMeetingCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/meeting\/([a-z2-9-]+)/i);
  return (match ? match[1] : trimmed).toLowerCase();
}
