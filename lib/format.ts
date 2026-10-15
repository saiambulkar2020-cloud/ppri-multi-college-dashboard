const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: INDIA_TIME_ZONE, day: "2-digit", month: "short", year: "numeric", ...options }).format(new Date(value));
}

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: INDIA_TIME_ZONE, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value));
}
