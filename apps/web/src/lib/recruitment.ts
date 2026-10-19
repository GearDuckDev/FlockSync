import type { Character, DayOfWeek, RaidTeam, Role } from '@flocksync/shared-types';
import { buildHumans, type Human } from './humans';
import { assignedCharacters, computeComposition, missingUtilities, utilitiesFor } from './composition';
import { DAY_NAMES, DAYS, dayStatus } from './schedule';

export interface HeatCell {
  regular: number;
  occasional: number;
}

export type Heatmap = Record<Role, Record<DayOfWeek, HeatCell>>;

const ROLES: Role[] = ['TANK', 'HEALER', 'DPS'];

const activeMembers = (h: Human): Character[] => h.characters.filter((c) => c.isActive);

/** The player's freshest availability across their Main and alts. */
const humanAvailability = (h: Human): Character | undefined =>
  activeMembers(h)
    .filter((c) => c.availability)
    .sort((a, b) => (b.availability?.updatedAt ?? 0) - (a.availability?.updatedAt ?? 0))[0];

const humanRole = (h: Human): Role | undefined => {
  const members = activeMembers(h);
  return (members.find((c) => c.guid === h.group.main.guid) ?? members[0])?.role.primaryRole;
};

export const buildHeatmap = (roster: Character[]): { heatmap: Heatmap; unset: number; humans: number } => {
  const heatmap = Object.fromEntries(
    ROLES.map((r) => [r, Object.fromEntries(DAYS.map((d) => [d, { regular: 0, occasional: 0 }]))]),
  ) as Heatmap;
  let unset = 0;
  const humans = buildHumans(roster).filter((h) => activeMembers(h).length > 0);
  for (const h of humans) {
    const source = humanAvailability(h);
    const role = humanRole(h);
    if (!source || !role) {
      unset += 1;
      continue;
    }
    for (const day of DAYS) {
      const status = dayStatus(source, day);
      if (status === 'REGULAR') heatmap[role][day].regular += 1;
      else if (status === 'OCCASIONAL') heatmap[role][day].occasional += 1;
    }
  }
  return { heatmap, unset, humans: humans.length };
};

export interface Callout {
  teamId: string;
  severity: 'need' | 'fill' | 'ok';
  text: string;
}

const ROLE_LABEL: Record<Role, string> = { TANK: 'Tank', HEALER: 'Healer', DPS: 'DPS' };
const TYPE_LABEL = { RAID: 'Raid', DUNGEON: 'Dungeon', PVP: 'PvP' } as const;

export const buildCallouts = (teams: RaidTeam[], roster: Character[]): Callout[] => {
  const humans = buildHumans(roster).filter((h) => activeMembers(h).length > 0);
  const byGuid = new Map(roster.map((c) => [c.guid, c]));
  return teams.map((team) => {
    const comp = computeComposition(team, byGuid);
    const assigned = new Set(assignedCharacters(team, byGuid).map((c) => c.guid));
    const free = humans.filter((h) => !h.characters.some((c) => assigned.has(c.guid)));
    const targets: Record<Role, number> = { TANK: team.targetTanks, HEALER: team.targetHealers, DPS: team.targetDps };
    const have: Record<Role, number> = { TANK: comp.tanks, HEALER: comp.healers, DPS: comp.dps };
    const label = `${DAY_NAMES[team.scheduledDay]} ${TYPE_LABEL[team.teamType]} ${team.raidSize}-Man (${team.name})`;
    const parts: string[] = [];
    let severity: Callout['severity'] = 'ok';
    for (const role of ROLES) {
      const short = targets[role] - have[role];
      if (short <= 0) continue;
      const regulars = free.filter(
        (h) => humanRole(h) === role && humanAvailabilityDay(h, team.scheduledDay) === 'REGULAR',
      ).length;
      const name = ROLE_LABEL[role];
      if (regulars >= short) {
        severity = severity === 'need' ? 'need' : 'fill';
        parts.push(`Short ${short} ${name} (${have[role]}/${targets[role]} assigned) — ${regulars} unassigned Regular ${name}s available on ${team.scheduledDay} to fill.`);
      } else {
        severity = 'need';
        parts.push(`Missing ${short - regulars} dependable ${name} (${have[role]}/${targets[role]} assigned, ${regulars} unassigned Regular ${name}s available on ${team.scheduledDay}).`);
      }
    }
    const missing = team.teamType === 'DUNGEON'
      ? []
      : missingUtilities(comp.classes, utilitiesFor(team.teamType)).map((u) => u.label);
    if (team.assignments.length > 0 && missing.length > 0) parts.push(`Missing utility: ${missing.join(', ')}.`);
    return { teamId: team.id, severity, text: `${label}: ${parts.length ? parts.join(' ') : 'Fully staffed.'}` };
  });
};

const humanAvailabilityDay = (h: Human, day: DayOfWeek): string | undefined => {
  const source = humanAvailability(h);
  return source ? dayStatus(source, day) : undefined;
};
