export function formatXAF(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} FCFA`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function formatTimeRemaining(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Closed';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days >= 1) return `${days}d ${hours}h left`;
  if (hours >= 1) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function getRoiWindowProgress(
  startIso?: string,
  endIso?: string,
  durationMonths: number = 12
): { elapsedDays: number; totalDays: number; pct: number; label: string } {
  const totalDays = Math.max(30, durationMonths * 30);
  if (!startIso || !endIso) {
    return {
      elapsedDays: 0,
      totalDays,
      pct: 0,
      label: `Starts when Race closes (${durationMonths}-month ROI window)`,
    };
  }
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const now = Date.now();
  const elapsedDays = Math.max(1, Math.min(totalDays, Math.floor((now - start) / (24 * 3600 * 1000))));
  const pct = Math.min(100, Math.max(2, Math.round(((now - start) / Math.max(1, end - start)) * 100)));
  return {
    elapsedDays,
    totalDays,
    pct,
    label: `${durationMonths}-Month ROI Window · Day ${elapsedDays} of ${totalDays}`,
  };
}
