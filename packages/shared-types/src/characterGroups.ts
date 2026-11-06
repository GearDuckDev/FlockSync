export interface GroupCharacter {
  guid: string;
  name: string;
  mainCharacterGuid?: string | undefined;
  mainCharacterName?: string | undefined;
  lastSeenAt: number;
  level: number;
}

export interface CharacterGroup<T extends GroupCharacter> {
  main: T;
  alts: T[];
  orphan: boolean;
}

const sameName = (a: string | undefined, b: string): boolean =>
  a !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

export const characterGroupKey = <T extends GroupCharacter>(group: CharacterGroup<T>): string =>
  group.orphan && group.main.mainCharacterGuid
    ? group.main.mainCharacterGuid
    : group.orphan && group.main.mainCharacterName
      ? `name:${group.main.mainCharacterName.trim().toLowerCase()}` : group.main.guid;

export const groupCharacters = <T extends GroupCharacter>(roster: T[]): CharacterGroup<T>[] => {
  const isMain = (c: T): boolean =>
    (c.mainCharacterGuid === undefined && c.mainCharacterName === undefined)
    || c.mainCharacterGuid === c.guid || sameName(c.mainCharacterName, c.name);
  const mains = roster.filter(isMain);
  const groups = new Map<string, CharacterGroup<T>>(mains.map((main) =>
    [main.guid, { main, alts: [], orphan: false }]));
  const orphans: CharacterGroup<T>[] = [];
  for (const alt of roster.filter((c) => !isMain(c))) {
    const owner = mains.find((m) => m.guid === alt.mainCharacterGuid || sameName(alt.mainCharacterName, m.name));
    const group = owner ? groups.get(owner.guid) : undefined;
    if (group) group.alts.push(alt);
    else orphans.push({ main: alt, alts: [], orphan: true });
  }
  for (const group of groups.values()) {
    group.alts.sort((a, b) => b.lastSeenAt - a.lastSeenAt
      || b.level - a.level || a.name.localeCompare(b.name));
  }
  const byName = (a: CharacterGroup<T>, b: CharacterGroup<T>): number => a.main.name.localeCompare(b.main.name);
  return [...groups.values()].sort(byName).concat(orphans.sort(byName));
};
