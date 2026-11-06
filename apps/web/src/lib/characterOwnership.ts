import type { CharacterOwnershipCatalog, SetCharacterOwner } from '@flocksync/shared-types';

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
