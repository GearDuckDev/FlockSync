import type { CharacterOwnershipCatalog, SetCharacterOwner, SetGroupOwner } from '@flocksync/shared-types';

export const prepareGroupOwnershipChange = (
  catalog: CharacterOwnershipCatalog, key: string, userId: string | null
): { input: SetGroupOwner; confirmation: string } => {
  const group = catalog.groups.find((row) => row.key === key);
  const next = catalog.users.find((row) => row.id === userId);
  if (!group || (userId !== null && !next)) throw new Error('Group or owner is no longer available. Refresh links.');
  const members = group.characterGuids.map((guid) => {
    const character = catalog.characters.find((row) => row.guid === guid);
    if (!character) throw new Error('Group membership changed. Refresh links.');
    const owner = catalog.ownerships.find((row) => row.characterGuid === guid);
    return { character, owner };
  });
  return {
    input: {
      groupKey: key, userId, expectedRevision: group.revision,
      expectedMembers: members.map(({ character, owner }) => ({
        characterGuid: character.guid, revision: owner?.revision ?? null
      })),
      confirmReassignment: members.some(({ owner }) => owner && owner.userId !== userId)
    },
    confirmation: `${next ? `Assign "${group.label}" to "${next.username}"` : `Revoke ownership of "${group.label}"`}?\n`
      + members.map(({ character, owner }) =>
        `${character.name}: ${catalog.users.find((row) => row.id === owner?.userId)?.username ?? 'Unlinked'}`).join('\n')
      + (next ? '\nAll current and future synced characters in this group will belong to this website user.'
        : '\nAll current group links are removed; future characters will not inherit this owner.')
      + '\nChanging main/alt grouping can change inherited access. Historical authors will not change. This is audited.'
  };
};

export const prepareOwnershipChange = (
  catalog: CharacterOwnershipCatalog, guid: string, userId: string | null
): { input: SetCharacterOwner; confirmation: string } => {
  const character = catalog.characters.find((entry) => entry.guid === guid);
  if (!character) throw new Error('Character is no longer available. Refresh the list.');
  const current = catalog.ownerships.find((entry) => entry.characterGuid === guid);
  const previous = catalog.users.find((entry) => entry.id === current?.userId);
  const next = catalog.users.find((entry) => entry.id === userId);
  if (userId !== null && !next) throw new Error('Website user is no longer available. Refresh the list.');
  return {
    input: { userId, expectedRevision: current?.revision ?? null, confirmReassignment: !!current && !!next },
    confirmation: next
      ? current
        ? `Reassign "${character.name}" from "${previous?.username ?? current.userId}" to "${next.username}"? Only the new owner will retain this character link. Historical authors will not change. This is audited.`
        : `Verify that "${character.name}" belongs to "${next.username}" and link it? This is audited.`
      : `Revoke "${character.name}" from "${previous?.username ?? current?.userId}"? Historical authors will not change. This is audited.`
  };
};
