import type { Character } from '@flocksync/shared-types';
import { groupRoster, type RosterGroup } from './roster';

export interface Human {
  key: string;
  group: RosterGroup;
  characters: Character[];
}

export const humanKey = (g: RosterGroup): string =>
  g.orphan && g.main.mainCharacterName ? `name:${g.main.mainCharacterName.trim().toLowerCase()}` : g.main.guid;

/** One entry per real player: a Main plus all of its linked alts. */
export const buildHumans = (roster: Character[]): Human[] => {
  const humans = new Map<string, Human>();
  for (const group of groupRoster(roster)) {
    const key = humanKey(group);
    const members = [group.main, ...group.alts];
    const existing = humans.get(key);
    if (existing) existing.characters.push(...members);
    else humans.set(key, { key, group, characters: members });
  }
  return [...humans.values()];
};

export const humanKeyByGuid = (humans: Human[]): Map<string, string> =>
  new Map(humans.flatMap((h) => h.characters.map((c) => [c.guid, h.key] as const)));
