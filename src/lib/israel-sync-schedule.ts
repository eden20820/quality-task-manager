export function isIsraelSixAm(value: Date): boolean {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value);

  return hour === "06";
}
