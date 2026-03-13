// Transfer window: Mon midnight → Fri 11pm UTC, fixed weekly schedule

export function isWindowOpen(now = new Date()): boolean {
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  // Open: Mon 00:00 → Fri 23:00
  if (day === 1 && h >= 0) return true;
  if (day === 2 || day === 3 || day === 4) return true;
  if (day === 5 && (h < 23 || (h === 23 && m === 0))) return true;
  return false;
}

export function nextOpenTime(now = new Date()): Date {
  // Next Monday midnight UTC
  const d = new Date(now);
  const daysUntilMon = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMon);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function nextCloseTime(now = new Date()): Date {
  // Next Friday 23:00 UTC
  const d = new Date(now);
  const day = d.getUTCDay();
  let daysUntilFri = (5 - day + 7) % 7;
  if (daysUntilFri === 0 && (d.getUTCHours() >= 23)) daysUntilFri = 7;
  d.setUTCDate(d.getUTCDate() + daysUntilFri);
  d.setUTCHours(23, 0, 0, 0);
  return d;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function timeUntilClose(now = new Date()): string {
  return formatCountdown(nextCloseTime(now).getTime() - now.getTime());
}

export function timeUntilOpen(now = new Date()): string {
  return formatCountdown(nextOpenTime(now).getTime() - now.getTime());
}
