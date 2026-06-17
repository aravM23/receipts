/** Receipt date/time labels, formatted once (server) to avoid hydration drift. */

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function receiptDateLabels(iso: string): {
  dateLabel: string;
  timeLabel: string;
  relativeLabel: string;
} {
  const d = new Date(iso);
  const dateLabel = `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;

  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  const timeLabel = `${h}:${String(m).padStart(2, "0")} ${ampm}`;

  const sameDay = new Date().toDateString() === d.toDateString();
  const relativeLabel = sameDay ? "TODAY" : dateLabel;

  return { dateLabel, timeLabel, relativeLabel };
}
