import type { Character } from '@flocksync/shared-types';
import { presenceOf } from './presence';
import type { Entity } from './wowheadNames';

export interface Crafter {
  character: Character;
  skill: number;
  maxLevel: number;
  accepting: boolean;
}

export interface RecipeEntry {
  key: string;
  profession: string;
  entity: Entity;
  crafters: Crafter[];
}

export interface ProfessionSummary {
  name: string;
  crafters: number;
  accepting: number;
}

/** Enchants have no item, so the addon stores their spell id; everything else is the crafted item. */
export const recipeEntity = (profession: string, id: number): Entity =>
  ({ kind: profession.toLowerCase() === 'enchanting' ? 'spell' : 'item', id });

const byAvailability = (a: Crafter, b: Crafter): number =>
  Number(b.accepting) - Number(a.accepting)
  || presenceOf(a.character).rank - presenceOf(b.character).rank
  || b.character.lastSeenAt - a.character.lastSeenAt;

export const buildRecipeIndex = (roster: Character[]): RecipeEntry[] => {
  const index = new Map<string, RecipeEntry>();
  for (const character of roster) {
    if (!character.isActive) continue;
    for (const p of character.professions?.primary ?? []) {
      const crafter: Crafter = { character, skill: p.level, maxLevel: p.maxLevel, accepting: p.acceptingRequests };
      for (const id of new Set(p.recipes)) {
        const key = `${p.name}:${id}`;
        const entry = index.get(key) ?? { key, profession: p.name, entity: recipeEntity(p.name, id), crafters: [] };
        entry.crafters.push(crafter);
        index.set(key, entry);
      }
    }
  }
  const entries = [...index.values()];
  for (const e of entries) e.crafters.sort(byAvailability);
  return entries;
};

export const summarizeProfessions = (roster: Character[]): ProfessionSummary[] => {
  const map = new Map<string, ProfessionSummary>();
  for (const c of roster) {
    if (!c.isActive) continue;
    for (const p of c.professions?.primary ?? []) {
      const s = map.get(p.name) ?? { name: p.name, crafters: 0, accepting: 0 };
      s.crafters += 1;
      if (p.acceptingRequests) s.accepting += 1;
      map.set(p.name, s);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** Matches recipe name, profession name or item/spell id. */
export const matchesRecipe = (entry: RecipeEntry, name: string | undefined, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return entry.profession.toLowerCase().includes(q)
    || String(entry.entity.id).includes(q)
    || (name?.toLowerCase().includes(q) ?? false);
};
