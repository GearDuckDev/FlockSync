import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleMemberGroups, memberGroupNotice } from '../src/lib/memberGroups.ts';

const teams = [
  { id: 'raid', teamType: 'RAID', assignments: [{ characterGuid: 'main' }], benchGuids: [] },
  { id: 'dungeon', teamType: 'DUNGEON', assignments: [], benchGuids: ['alt'] },
  { id: 'pvp', teamType: 'PVP', assignments: [{ characterGuid: 'other' }], benchGuids: [] },
  { id: 'unrelated', teamType: 'RAID', assignments: [{ characterGuid: 'unverified-alt' }], benchGuids: [] }
];
const links = [{ characterGuid: 'main' }, { characterGuid: 'alt' }];

test('members see only assigned or benched groups of any verified character across group types', () => {
  assert.deepEqual(visibleMemberGroups(teams, links, false).map((team) => team.id), ['raid', 'dungeon']);
  assert.deepEqual(visibleMemberGroups(teams, [{ characterGuid: 'other' }], false).map((team) => team.id), ['pvp']);
  assert.deepEqual(visibleMemberGroups(teams, [], false), []);
  assert.deepEqual(visibleMemberGroups(teams, [{ characterGuid: 'missing' }], false), []);
  assert.equal(teams.length, 4, 'filter does not mutate full delivered snapshot');
});

test('officers/admins retain all groups without ownership prerequisites', () => {
  assert.equal(visibleMemberGroups(teams, [], true), teams);
});

test('ownership revocation/reassignment immediately changes the filtered result on refresh', () => {
  const selected = visibleMemberGroups(teams, links, false)[0];
  assert.ok(selected);
  assert.ok(!visibleMemberGroups(teams, [], false).includes(selected));
  assert.ok(!visibleMemberGroups(teams, [{ characterGuid: 'other' }], false).includes(selected));
});

test('unlinked/loading/no-membership states explain next actions without exposing group names', () => {
  assert.match(memberGroupNotice(true, 0, 0), /Checking/);
  assert.match(memberGroupNotice(false, 0, 0), /Character-link management is not available/);
  assert.match(memberGroupNotice(false, 1, 0), /None of your verified/);
  assert.match(memberGroupNotice(false, 2, 1), /including bench/);
});
