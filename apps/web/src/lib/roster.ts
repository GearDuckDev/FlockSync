import { groupCharacters, type CharacterGroup, type Character } from '@flocksync/shared-types';

export type RosterGroup = CharacterGroup<Character>;
export const groupRoster = (roster: Character[]): RosterGroup[] => groupCharacters(roster);

export interface RosterStats {
  uniqueMains: number;
  totalCharacters: number;
  tanks: number;
  healers: number;
  dps: number;
  inactive: number;
}

export const computeStats = (roster: Character[], groups: RosterGroup[]): RosterStats => {
  const active = roster.filter((c) => c.isActive);
  const count = (role: string): number => active.filter((c) => c.role.primaryRole === role).length;
  return {
    uniqueMains: groups.filter((g) => !g.orphan && (g.main.isActive || g.alts.some((a) => a.isActive))).length,
    totalCharacters: active.length,
    tanks: count('TANK'),
    healers: count('HEALER'),
    dps: count('DPS'),
    inactive: roster.length - active.length,
  };
};
