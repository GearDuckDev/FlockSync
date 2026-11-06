import type { CharacterOwnership, RaidTeam } from '@flocksync/shared-types';

export const visibleMemberGroups = (
  teams: RaidTeam[], links: CharacterOwnership[], canManage: boolean
): RaidTeam[] => {
  if (canManage) return teams;
  const owned = new Set(links.map((link) => link.characterGuid));
  return teams.filter((team) => team.assignments.some((slot) => owned.has(slot.characterGuid))
    || team.benchGuids.some((guid) => owned.has(guid)));
};

export const memberGroupNotice = (loading: boolean, linkedCount: number, groupCount: number): string =>
  loading ? 'Checking your linked characters and group memberships...'
    : linkedCount === 0
      ? 'No linked characters are available to this account. Character-link management is not available in the web app.'
      : groupCount === 0 ? 'None of your verified linked characters are assigned or benched in a group.'
        : 'Showing groups containing any of your verified linked characters, including bench membership. Only officers and admins can edit.';
