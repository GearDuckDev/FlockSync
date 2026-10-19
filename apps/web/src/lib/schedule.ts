import type {
  AvailabilityCommitment,
  Character,
  DayOfWeek,
  RaidLockout,
} from '@flocksync/shared-types';

export const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Lockouts whose reset time has not passed yet. */
export const activeLockouts = (c: Character): RaidLockout[] =>
  (c.lockouts?.lockouts ?? []).filter((l) => l.resetAt > nowSeconds());

const norm = (s: string): string => s.trim().toLowerCase();

export const lockoutFor = (c: Character, instanceName: string): RaidLockout | undefined => {
  const target = norm(instanceName);
  return activeLockouts(c).find((l) => {
    const name = norm(l.instanceName);
    return name === target || name.includes(target) || target.includes(name);
  });
};

export const dayStatus = (c: Character, day: DayOfWeek): AvailabilityCommitment | undefined =>
  c.availability?.schedule.find((s) => s.day === day)?.status;

export const availabilityDays = (c: Character): { regular: DayOfWeek[]; occasional: DayOfWeek[] } => {
  const pick = (status: AvailabilityCommitment): DayOfWeek[] =>
    DAYS.filter((d) => dayStatus(c, d) === status);
  return { regular: pick('REGULAR'), occasional: pick('OCCASIONAL') };
};

export const formatReset = (resetAt: number): string => {
  const seconds = Math.max(0, resetAt - nowSeconds());
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
};
