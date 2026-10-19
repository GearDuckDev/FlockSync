import type { AttendanceRecord } from '@flocksync/shared-types';
import type { Human } from './humans';

export const WINDOWS = [30, 60, 90] as const;

export interface AttendanceRow {
  key: string;
  name: string;
  alts: string[];
  /** Raids attended within each window (a Main or any of their alts counts once). */
  attended: Record<number, number>;
}

export interface AttendanceSummary {
  totals: Record<number, number>;
  rows: AttendanceRow[];
}

export const summarizeAttendance = (humans: Human[], records: AttendanceRecord[], nowSec: number): AttendanceSummary => {
  const totals: Record<number, number> = {};
  const sets = records.map((r) => ({ r, guids: new Set(r.rosterGuids) }));
  for (const w of WINDOWS) totals[w] = records.filter((r) => r.timestamp >= nowSec - w * 86400).length;

  const rows = humans
    .filter((h) => h.group.main.isActive)
    .map((h): AttendanceRow => {
      const attended: Record<number, number> = {};
      for (const w of WINDOWS) {
        const cutoff = nowSec - w * 86400;
        attended[w] = sets.filter(({ r, guids }) => r.timestamp >= cutoff && h.characters.some((c) => guids.has(c.guid))).length;
      }
      return { key: h.key, name: h.group.main.name, alts: h.characters.filter((c) => c !== h.group.main).map((c) => c.name), attended };
    })
    .sort((a, b) => b.attended[90]! - a.attended[90]! || a.name.localeCompare(b.name));
  return { totals, rows };
};
