import type { Character } from '@flocksync/shared-types';

export interface GoalWant {
  character: Character;
  itemId: number;
  itemLink: string;
  note: string | undefined;
}

export interface GoalGroup {
  key: string;
  title: string;
  wants: GoalWant[];
  /** Distinct characters; a 5-man group needs at least this many people. */
  size: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'from', 'need', 'needs', 'want', 'wants', 'drop', 'drops', 'boss', 'item',
  'with', 'any', 'dungeon', 'raid', 'run', 'runs', 'upgrade', 'gear', 'bis', 'pre', 'tank', 'tanking',
  'healing', 'dps', 'quest', 'my', 'a', 'an', 'to', 'of', 'in', 'on',
]);

/** Keywords in a note, such as "BRD" from "BRD Vault". */
export const noteKeywords = (note: string | undefined): string[] => {
  if (!note) return [];
  const words = note.toLowerCase().match(/[a-z0-9']{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP_WORDS.has(w)))];
};

export const collectWants = (roster: Character[]): GoalWant[] =>
  roster
    .filter((c) => c.isActive)
    .flatMap((character) =>
      (character.gearGoals?.goals ?? []).map((g) => ({ character, itemId: g.itemId, itemLink: g.itemLink, note: g.note })));

const toGroups = (map: Map<string, { title: string; wants: GoalWant[] }>): GoalGroup[] =>
  [...map.entries()]
    .map(([key, v]) => ({ key, title: v.title, wants: v.wants, size: new Set(v.wants.map((w) => w.character.guid)).size }))
    .sort((a, b) => b.size - a.size || a.title.localeCompare(b.title));

export const groupByItem = (wants: GoalWant[]): GoalGroup[] => {
  const map = new Map<string, { title: string; wants: GoalWant[] }>();
  for (const w of wants) {
    const entry = map.get(String(w.itemId)) ?? { title: `Item #${w.itemId}`, wants: [] };
    entry.wants.push(w);
    map.set(String(w.itemId), entry);
  }
  return toGroups(map);
};

/** Groups goals whose notes share a keyword; keywords used by only one character are dropped. */
export const groupByNote = (wants: GoalWant[]): GoalGroup[] => {
  const map = new Map<string, { title: string; wants: GoalWant[] }>();
  for (const w of wants) {
    for (const word of noteKeywords(w.note)) {
      const entry = map.get(word) ?? { title: word.toUpperCase(), wants: [] };
      entry.wants.push(w);
      map.set(word, entry);
    }
  }
  return toGroups(map).filter((g) => g.size > 1);
};
