const MS_PER_DAY = 86_400_000;

/** Date -> "YYYY-MM-DD" in local time (the format <input type="date"> uses). */
export function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> local midnight (new Date("2026-10-12") would be UTC and can shift a day). */
export function parseDateOnly(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function daysFromToday(value, now = new Date()) {
  return Math.round((parseDateOnly(value) - startOfDay(now)) / MS_PER_DAY);
}

/** Text for the due cell: { when, note, overdue, empty } */
export function describeDue(value, now = new Date()) {
  if (!value) return { when: "No date", note: "", overdue: false, empty: true };
  const diff = daysFromToday(value, now);
  const date = parseDateOnly(value);
  const label = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  if (diff === 0)
    return { when: "Today", note: "", overdue: false, empty: false };
  if (diff === 1)
    return { when: "Tomorrow", note: "", overdue: false, empty: false };
  if (diff < 0) {
    return {
      when: label,
      note: diff === -1 ? "1 day late" : `${-diff} days late`,
      overdue: true,
      empty: false,
    };
  }
  return { when: label, note: "", overdue: false, empty: false };
}
