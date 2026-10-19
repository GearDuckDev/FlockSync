import type { Character } from '@flocksync/shared-types';

export interface StuckGroup {
  key: string;
  label: string;
  attuned: boolean;
  members: Character[];
}

export interface ChainView {
  chainId: string;
  name: string;
  total: number;
  groups: StuckGroup[];
}

/** Players are grouped by the first incomplete step of each chain, so officers can pull a group for it. */
export const buildChainViews = (roster: Character[]): ChainView[] => {
  const chains = new Map<string, ChainView>();
  for (const character of roster) {
    if (!character.isActive) continue;
    for (const chain of character.attunements ?? []) {
      const view = chains.get(chain.chainId) ?? { chainId: chain.chainId, name: chain.name, total: chain.steps.length, groups: [] };
      chains.set(chain.chainId, view);
      const next = chain.steps.find((s) => !s.completed);
      const done = chain.steps.filter((s) => s.completed).length;
      const attuned = chain.isFullyAttuned || next === undefined;
      const key = attuned ? 'done' : `step:${next.stepId}`;
      const label = attuned
        ? 'Fully attuned'
        : `Step ${next.stepId}: ${next.name}${done === 0 ? ' (not started)' : ''}`;
      let group = view.groups.find((g) => g.key === key);
      if (!group) {
        group = { key, label, attuned, members: [] };
        view.groups.push(group);
      }
      group.members.push(character);
    }
  }
  for (const view of chains.values()) {
    view.groups.sort((a, b) => Number(a.attuned) - Number(b.attuned) || a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  return [...chains.values()];
};
