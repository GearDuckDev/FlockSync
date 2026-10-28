import type { AttunementChain, Character } from '@flocksync/shared-types';
import { buildHumans } from './humans';

export interface CharacterProgress {
  character: Character;
  completed: number;
  total: number;
  attuned: boolean;
  label: string;
  reported: boolean;
}

export interface AttunementFamily {
  key: string;
  main: CharacterProgress;
  alts: CharacterProgress[];
  orphan: boolean;
}

export interface StuckGroup {
  key: string;
  label: string;
  attuned: boolean;
  members: AttunementFamily[];
}

export interface ChainView {
  chainId: string;
  name: string;
  total: number;
  groups: StuckGroup[];
}

const progress = (character: Character, chain: AttunementChain | undefined): CharacterProgress => {
  const next = chain?.steps.find((step) => !step.completed);
  const attuned = chain !== undefined && (chain.isFullyAttuned || next === undefined);
  const completed = chain?.steps.filter((step) => step.completed).length ?? 0;
  return {
    character, completed, total: chain?.steps.length ?? 0, attuned,
    reported: chain !== undefined,
    label: !chain ? 'No synced progress' : attuned ? 'Fully attuned'
      : `Step ${next?.stepId}: ${next?.name}${completed === 0 ? ' (not started)' : ''}`,
  };
};

/** Only main progress chooses a section; linked alts never become separate entries. */
export const buildChainViews = (roster: Character[]): ChainView[] => {
  const chains = new Map<string, ChainView>();
  const humans = buildHumans(roster);
  for (const character of roster.filter((entry) => entry.isActive)) {
    for (const chain of character.attunements ?? []) {
      if (!chains.has(chain.chainId)) {
        chains.set(chain.chainId, {
          chainId: chain.chainId, name: chain.name, total: chain.steps.length, groups: [],
        });
      }
    }
  }
  for (const view of chains.values()) {
    for (const human of humans) {
      const active = human.characters.filter((character) => character.isActive);
      if (!active.some((character) => character.attunements?.some((chain) => chain.chainId === view.chainId))) continue;
      const mainCharacter = human.group.main;
      const mainChain = !human.group.orphan
        ? mainCharacter.attunements?.find((chain) => chain.chainId === view.chainId) : undefined;
      const main = progress(mainCharacter, mainChain);
      const next = mainChain?.steps.find((step) => !step.completed);
      const key = !main.reported ? 'unknown' : main.attuned ? 'done' : `step:${next?.stepId}`;
      let group = view.groups.find((entry) => entry.key === key);
      if (!group) {
        group = {
          key, label: key === 'unknown' ? 'No synced main progress / main not on roster' : main.label,
          attuned: main.attuned, members: [],
        };
        view.groups.push(group);
      }
      group.members.push({
        key: human.key, main, orphan: human.group.orphan,
        alts: active.filter((character) => human.group.orphan || character.guid !== mainCharacter.guid)
          .map((character) => progress(character, character.attunements?.find((chain) => chain.chainId === view.chainId)))
          .sort((a, b) => b.character.level - a.character.level
            || a.character.name.localeCompare(b.character.name)),
      });
    }
    view.groups.sort((a, b) => Number(a.key === 'unknown') - Number(b.key === 'unknown')
      || Number(a.attuned) - Number(b.attuned) || a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  return [...chains.values()];
};
