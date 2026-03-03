/**
 * Formats tenure as "Xmo Yd" (months and days) from a join date ISO string.
 * Examples: "3mo 5d", "14mo 0d" → "14mo", "0mo 20d" → "20d"
 */
export function fmtTenure(joinDateISO: string): string {
  const join = new Date(joinDateISO);
  const today = new Date();

  let months =
    (today.getFullYear() - join.getFullYear()) * 12 +
    (today.getMonth() - join.getMonth());
  let days = today.getDate() - join.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      0
    ).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    const totalDays = Math.floor(
      (today.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)
    );
    return totalDays <= 0 ? "< 1d" : `${totalDays}d`;
  }

  if (months === 0) return `${days}d`;
  if (days === 0) return `${months}mo`;
  return `${months}mo ${days}d`;
}
