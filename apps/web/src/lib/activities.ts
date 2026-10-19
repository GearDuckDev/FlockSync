import type { RaidSize, TeamType } from '@flocksync/shared-types';

export interface InstanceInfo {
  name: string;
  sizes?: RaidSize[];
  description?: string;
  groupLabels?: string[];
}

export interface Activity {
  label: string;
  sizes: RaidSize[];
  instances: InstanceInfo[];
}

const names = (list: string[]): InstanceInfo[] => list.map((name) => ({ name }));

export const ACTIVITIES: Record<TeamType, Activity> = {
  RAID: {
    label: 'Raid',
    sizes: [10, 20, 40],
    instances: names([
      'Molten Core', "Onyxia's Lair", 'Blackwing Lair', "Zul'Gurub",
      "Ruins of Ahn'Qiraj", "Temple of Ahn'Qiraj", 'Naxxramas',
    ]),
  },
  DUNGEON: {
    label: 'Dungeon',
    sizes: [5],
    instances: names([
      'Ragefire Chasm', 'The Deadmines', 'Wailing Caverns', 'Shadowfang Keep', 'Blackfathom Deeps',
      'The Stockade', 'Gnomeregan', 'Razorfen Kraul', 'Scarlet Monastery', 'Razorfen Downs',
      'Uldaman', "Zul'Farrak", 'Maraudon', 'Sunken Temple', 'Blackrock Depths',
      'Lower Blackrock Spire', 'Dire Maul', 'Scholomance', 'Stratholme',
    ]),
  },
  PVP: {
    label: 'PvP',
    sizes: [5, 10, 15, 20, 40],
    instances: [
      {
        name: 'Warsong Gulch', sizes: [10],
        description: 'Capture the flag: assign a flag carrier escort, offense and flag-hunter defense.',
        groupLabels: ['Offense / Flag Escort', 'Defense / Flag Hunters'],
      },
      {
        name: 'Arathi Basin', sizes: [15],
        description: 'Five resource nodes: split the raid into node squads.',
        groupLabels: ['Blacksmith (Central)', 'Stables & Farm', 'Lumber Mill & Gold Mine'],
      },
      {
        name: 'Alterac Valley', sizes: [40],
        description: '40v40 battleground: assign assault, tower and graveyard teams.',
        groupLabels: ['Main Assault', 'Main Assault', 'Tower Team', 'Tower Team',
          'Graveyard Defense', 'Graveyard Defense', 'Mines / Caves', 'Reserve / Roaming'],
      },
      {
        name: 'Open World', sizes: [5, 10, 15, 20, 40],
        description: 'Non-instanced PvP raid: any size, prioritise healing and crowd control.',
      },
    ],
  },
};

export const TIMEZONES = ['EST', 'CST', 'MST', 'PST', 'UTC', 'GMT', 'CET', 'AEST'];

export const instanceInfo = (type: TeamType, name: string): InstanceInfo | undefined =>
  ACTIVITIES[type].instances.find((i) => i.name === name);

export const MAX_PARTIES = 40;

export const sizesFor = (type: TeamType, instance: string): RaidSize[] =>
  (type === 'PVP' ? instanceInfo(type, instance)?.sizes : undefined) ?? ACTIVITIES[type].sizes;

export const groupLabel = (type: TeamType, instance: string, group: number): string => {
  const custom = instanceInfo(type, instance)?.groupLabels?.[group - 1];
  if (custom) return `Group ${group} — ${custom}`;
  return type === 'DUNGEON' ? `Party ${group}` : `Group ${group}`;
};

export interface Targets {
  targetTanks: number;
  targetHealers: number;
  targetDps: number;
}

export const defaultTargets = (type: TeamType, size: number): Targets => {
  if (type === 'DUNGEON') {
    const parties = size / 5;
    return { targetTanks: parties, targetHealers: parties, targetDps: parties * 3 };
  }
  const tanks = type === 'PVP' ? 0 : Math.ceil(size / 10);
  const healers = Math.ceil(size / 4);
  return { targetTanks: tanks, targetHealers: healers, targetDps: size - tanks - healers };
};

export const defaultsFor = (type: TeamType): { instanceName: string; raidSize: RaidSize } & Targets => {
  const instance = ACTIVITIES[type].instances[0]?.name ?? '';
  const raidSize = sizesFor(type, instance)[0] ?? 40;
  return { instanceName: instance, raidSize, ...defaultTargets(type, raidSize) };
};
