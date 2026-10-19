import type { Character, DayOfWeek } from '@flocksync/shared-types';
import { DAYS, nowSeconds } from './schedule';

export type PresenceTone = 'online' | 'tonight' | 'maybe' | 'offline';

export interface Presence {
  tone: PresenceTone;
  label: string;
  detail: string;
  rank: number;
}

const ONLINE_WINDOW_SECONDS = 20 * 60;

const todayKey = (): DayOfWeek => DAYS[(new Date().getDay() + 6) % 7] ?? 'MON';

const ago = (seconds: number): string => {
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

/** Combines how recently a character was seen with the player's availability for today. */
export const presenceOf = (c: Character): Presence => {
  const since = nowSeconds() - c.lastSeenAt;
  const entry = c.availability?.schedule.find((s) => s.day === todayKey());
  const window = entry && entry.status !== 'UNAVAILABLE'
    ? `${entry.startTime}–${entry.endTime} ${c.availability?.timezone ?? ''}`.trim()
    : '';

  if (since <= ONLINE_WINDOW_SECONDS) {
    return { tone: 'online', label: 'Online now', detail: window ? `Playing ${window} today` : 'Seen just now', rank: 0 };
  }
  if (entry?.status === 'REGULAR') {
    return { tone: 'tonight', label: 'Likely tonight', detail: `Regular today ${window} · seen ${ago(since)}`, rank: 1 };
  }
  if (entry?.status === 'OCCASIONAL') {
    return { tone: 'maybe', label: 'Maybe tonight', detail: `Occasional today ${window} · seen ${ago(since)}`, rank: 2 };
  }
  return { tone: 'offline', label: `Seen ${ago(since)}`, detail: entry ? 'Unavailable today' : 'No availability set', rank: 3 };
};
