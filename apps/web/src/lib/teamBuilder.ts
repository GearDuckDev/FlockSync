import type { RaidSlotAssignment, RaidTeamInput, Role } from '@flocksync/shared-types';
import { defaultsFor } from './activities';

export const emptyTeam = (): RaidTeamInput => ({
  name: 'New Raid Team',
  teamType: 'RAID',
  ...defaultsFor('RAID'),
  scheduledDay: 'TUE',
  startTime: '19:00',
  endTime: '23:00',
  timezone: 'EST',
  assignments: [],
  benchGuids: [],
});

export const groupCount = (raidSize: number): number => raidSize / 5;

type KeyOf = (guid: string) => string | undefined;

/** Removes every character of the same human as `guid` from slots and bench. */
const withoutHuman = (team: RaidTeamInput, guid: string, keyOf: KeyOf): RaidTeamInput => {
  const key = keyOf(guid);
  const same = (g: string): boolean => g === guid || (key !== undefined && keyOf(g) === key);
  return {
    ...team,
    assignments: team.assignments.filter((a) => !same(a.characterGuid)),
    benchGuids: team.benchGuids.filter((g) => !same(g)),
  };
};

export interface PlaceResult {
  team: RaidTeamInput;
  /** Guids of other characters of the same player that were swapped out. */
  swappedOut: string[];
}

export const placeInSlot = (
  team: RaidTeamInput, guid: string, role: Role, groupIndex: number, slotIndex: number, keyOf: KeyOf,
): PlaceResult => {
  const key = keyOf(guid);
  const swappedOut = [...team.assignments.map((a) => a.characterGuid), ...team.benchGuids].filter(
    (g) => g !== guid && key !== undefined && keyOf(g) === key,
  );
  const cleared = withoutHuman(team, guid, keyOf);
  const occupant = cleared.assignments.find((a) => a.groupIndex === groupIndex && a.slotIndex === slotIndex);
  const assignment: RaidSlotAssignment = { groupIndex, slotIndex, characterGuid: guid, assignedRole: role };
  return {
    team: {
      ...cleared,
      assignments: [...cleared.assignments.filter((a) => a !== occupant), assignment],
      benchGuids: occupant ? [...cleared.benchGuids, occupant.characterGuid] : cleared.benchGuids,
    },
    swappedOut,
  };
};

export const placeOnBench = (team: RaidTeamInput, guid: string, keyOf: KeyOf): PlaceResult => {
  const key = keyOf(guid);
  const swappedOut = [...team.assignments.map((a) => a.characterGuid), ...team.benchGuids].filter(
    (g) => g !== guid && key !== undefined && keyOf(g) === key,
  );
  const cleared = withoutHuman(team, guid, keyOf);
  return { team: { ...cleared, benchGuids: [...cleared.benchGuids, guid] }, swappedOut };
};

export const removeFromTeam = (team: RaidTeamInput, guid: string): RaidTeamInput => ({
  ...team,
  assignments: team.assignments.filter((a) => a.characterGuid !== guid),
  benchGuids: team.benchGuids.filter((g) => g !== guid),
});

/** Drops slots that no longer exist after shrinking the raid size. */
export const fitToSize = (team: RaidTeamInput): RaidTeamInput => {
  const groups = groupCount(team.raidSize);
  const kept = team.assignments.filter((a) => a.groupIndex <= groups);
  const dropped = team.assignments.filter((a) => a.groupIndex > groups).map((a) => a.characterGuid);
  return { ...team, assignments: kept, benchGuids: [...team.benchGuids, ...dropped] };
};
