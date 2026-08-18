export type RecurringReminder = {
  reminder_date: string;
  repeat_unit: "day" | "month" | null;
  repeat_interval: number | null;
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function reminderOccursOn(reminder: RecurringReminder, targetDate: string) {
  if (targetDate < reminder.reminder_date) return false;
  if (!reminder.repeat_unit || !reminder.repeat_interval) return targetDate === reminder.reminder_date;

  const start = parseDate(reminder.reminder_date);
  const target = parseDate(targetDate);

  if (reminder.repeat_unit === "day") {
    const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
    return days % reminder.repeat_interval === 0;
  }

  const monthDifference = (target.getUTCFullYear() - start.getUTCFullYear()) * 12 + target.getUTCMonth() - start.getUTCMonth();
  if (monthDifference < 0 || monthDifference % reminder.repeat_interval !== 0) return false;
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return target.getUTCDate() === Math.min(start.getUTCDate(), lastDayOfTargetMonth);
}

export function reminderDatesInRange(reminder: RecurringReminder, startDate: string, endDateExclusive: string) {
  const dates: string[] = [];
  const cursor = parseDate(startDate);
  const end = parseDate(endDateExclusive);
  while (cursor < end) {
    const date = formatDate(cursor);
    if (reminderOccursOn(reminder, date)) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
