import { serverIdFromGuid, type Character, type OfficerSyncPayload } from "@flocksync/shared-types";

const withServerRealm = (character: Character): Character =>
  ({ ...character, realm: serverIdFromGuid(character.guid) ?? character.realm });

// Older addons upload realm labels (or the collector's realm for other servers);
// the GUID server id is authoritative. Same-realm guild data follows the officer.
export const normalizeSyncRealms = (payload: OfficerSyncPayload): OfficerSyncPayload => {
  const officerCharacter = withServerRealm(payload.officerCharacter);
  const legacyGuildRealm = payload.collectorGuild?.realm;
  const guildRealm = legacyGuildRealm === payload.officerCharacter.realm
    ? officerCharacter.realm : legacyGuildRealm;
  const sameRealm = (realm: string): string =>
    realm === legacyGuildRealm && guildRealm !== undefined ? guildRealm : realm;
  return {
    ...payload,
    officerCharacter,
    characters: payload.characters.map(withServerRealm),
    ...(payload.collectorGuild && guildRealm !== undefined
      ? { collectorGuild: { ...payload.collectorGuild, realm: guildRealm } } : {}),
    ...(payload.sharedKillList
      ? { sharedKillList: payload.sharedKillList.map((entry) => ({ ...entry, realm: sameRealm(entry.realm) })) } : {}),
    ...(payload.sharedKillObservations
      ? { sharedKillObservations: payload.sharedKillObservations.map((entry) => ({ ...entry, realm: sameRealm(entry.realm) })) }
      : {})
  };
};
