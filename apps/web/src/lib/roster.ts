import type { Character } from '@flocksync/shared-types';

export interface RosterGroup {
  main: Character;
  alts: Character[];
  /** True when this entry is an alt whose main is not on the roster. */
  orphan: boolean;
}

const sameName = (a: string | undefined, b: string): boolean =>
  a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

const isMain = (c: Character): boolean =>
  (c.mainCharacterGuid === undefined && c.mainCharacterName === undefined) ||
  c.mainCharacterGuid === c.guid ||
  sameName(c.mainCharacterName, c.name);

export const groupRoster = (roster: Character[]): RosterGroup[] => {
  const mains = roster.filter(isMain);
  const groups = new Map<string, RosterGroup>(mains.map((m) => [m.guid, { main: m, alts: [], orphan: false }]));
  const orphans: RosterGroup[] = [];

  for (const alt of roster.filter((c) => !isMain(c))) {
    const owner = mains.find((m) => m.guid === alt.mainCharacterGuid || sameName(alt.mainCharacterName, m.name));
    const group = owner ? groups.get(owner.guid) : undefined;
    if (group) group.alts.push(alt);
    else orphans.push({ main: alt, alts: [], orphan: true });
  }

  const byName = (a: RosterGroup, b: RosterGroup): number => a.main.name.localeCompare(b.main.name);
  return [...groups.values()].sort(byName).concat(orphans.sort(byName));
};

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
