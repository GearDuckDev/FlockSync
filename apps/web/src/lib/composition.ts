import type { Character, RaidTeamInput, TeamType } from '@flocksync/shared-types';
import { classInfo } from './wow';

export interface Utility {
  label: string;
  classIds: number[];
}

/** Class-provided raid/party utility (Classic-era kit). */
export const UTILITIES: Utility[] = [
  { label: 'Fortitude / Divine Spirit', classIds: [5] },
  { label: 'Mark of the Wild / Innervate', classIds: [11] },
  { label: 'Arcane Intellect', classIds: [8] },
  { label: 'Paladin Blessings', classIds: [2] },
  { label: 'Shaman Totems', classIds: [7] },
  { label: 'Curses / Summons / Soulstone', classIds: [9] },
  { label: 'Battle Shout', classIds: [1] },
  { label: 'Trueshot Aura / Tranq Shot', classIds: [3] },
  { label: 'Expose Armor / Kick', classIds: [4] },
];

export const PVP_UTILITIES: Utility[] = [
  { label: 'Healing support', classIds: [5, 2, 11, 7] },
  { label: 'Dispels / Cleanse', classIds: [5, 2, 7] },
  { label: 'Crowd control', classIds: [8, 4, 9, 3, 11] },
  { label: 'Mobility / flag carrier', classIds: [11, 7, 4, 2] },
  { label: 'Interrupts', classIds: [1, 4, 8, 7] },
];

export const utilitiesFor = (type: TeamType): Utility[] => (type === 'PVP' ? PVP_UTILITIES : UTILITIES);

export const TRACKED_CLASS_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 11];

export interface Composition {
  tanks: number;
  healers: number;
  dps: number;
  classes: Map<number, number>;
}

export const assignedCharacters = (team: RaidTeamInput, byGuid: Map<string, Character>): Character[] =>
  team.assignments.flatMap((a) => {
    const c = byGuid.get(a.characterGuid);
    return c ? [c] : [];
  });

/** Pass groupIndex to count a single group (used for dungeon parties). */
export const computeComposition = (
  team: RaidTeamInput, byGuid: Map<string, Character>, groupIndex?: number,
): Composition => {
  const comp: Composition = { tanks: 0, healers: 0, dps: 0, classes: new Map() };
  for (const a of team.assignments) {
    if (groupIndex !== undefined && a.groupIndex !== groupIndex) continue;
    if (a.assignedRole === 'TANK') comp.tanks += 1;
    else if (a.assignedRole === 'HEALER') comp.healers += 1;
    else comp.dps += 1;
    const c = byGuid.get(a.characterGuid);
    if (c) comp.classes.set(c.classId, (comp.classes.get(c.classId) ?? 0) + 1);
  }
  return comp;
};

export const isCovered = (u: Utility, classes: Map<number, number>): boolean =>
  u.classIds.some((id) => (classes.get(id) ?? 0) > 0);

export const missingUtilities = (classes: Map<number, number>, list: Utility[] = UTILITIES): Utility[] =>
  list.filter((u) => !isCovered(u, classes));

export const utilityClasses = (u: Utility): string => u.classIds.map((id) => classInfo(id).name).join(' / ');

export const className = (classId: number): string => classInfo(classId).name;
