import type { NoticeCard } from "./notice";

type PlainDate = { year: number; month: number; day: number };

function valid(date: PlainDate): boolean {
  const actual = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return actual.getUTCFullYear() === date.year && actual.getUTCMonth() + 1 === date.month && actual.getUTCDate() === date.day;
}

function stamp(date: PlainDate): string {
  return `${date.year}${String(date.month).padStart(2, "0")}${String(date.day).padStart(2, "0")}`;
}

function nextDay(date: PlainDate): PlainDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function parseEventDates(text: string): { start: PlainDate; end: PlainDate } | null {
  const matches = [...text.matchAll(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日/g)];
  if (!matches.length) return null;
  const firstYear = matches[0][1] ? Number(matches[0][1]) : null;
  if (!firstYear) return null;
  const start = { year: firstYear, month: Number(matches[0][2]), day: Number(matches[0][3]) };
  const final = matches.at(-1)!;
  let endYear = final[1] ? Number(final[1]) : firstYear;
  const endMonth = Number(final[2]);
  if (!final[1] && endMonth < start.month) endYear += 1;
  const end = { year: endYear, month: endMonth, day: Number(final[3]) };
  if (!valid(start) || !valid(end) || stamp(end) < stamp(start)) return null;
  return { start, end };
}

export function makeEventIcs(card: NoticeCard): string | null {
  const dates = card.eventTime && parseEventDates(card.eventTime.value);
  if (!dates) return null;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@bieloushi.local`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BieLouShi//Notice Calendar//ZH",
    "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${stamp(dates.start)}`,
    `DTEND;VALUE=DATE:${stamp(nextDay(dates.end))}`,
    `SUMMARY:${escapeIcs(card.title.value || "未命名通知")}`,
    ...(card.place?.value ? [`LOCATION:${escapeIcs(card.place.value)}`] : []),
    "DESCRIPTION:由别漏事从通知整理。请对照原文核实。",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:活动即将开始", "TRIGGER:-P1D", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}
