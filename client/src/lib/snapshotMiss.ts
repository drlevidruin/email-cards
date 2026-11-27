export const MISS_GRACE_MS = 10 * 60 * 1000;

/** What to do when the snapshot is missing or will not open: note the first miss, or forget once it has lasted 10 minutes. */
export function missStep(firstMissAt: number | null, now: number): 'remember' | 'forget' {
  if (firstMissAt === null || !Number.isFinite(firstMissAt)) return 'remember';
  const age = now - firstMissAt;
  return age >= MISS_GRACE_MS ? 'forget' : 'remember';
}
