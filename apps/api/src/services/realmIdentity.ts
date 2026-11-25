import { serverIdFromGuid, type Character, type OfficerSyncPayload } from "@flocksync/shared-types";

const withServerRealm = (character: Character): Character =>
  ({ ...character, realm: serverIdFromGuid(character.guid) ?? character.realm });

// Older addons upload realm labels (or the collector's realm for other servers);
// the GUID server id is authoritative for characters. Guild and kill-list realms
// are left as sent: guilds match by name, and a label kill target means any server.
export const normalizeSyncRealms = (payload: OfficerSyncPayload): OfficerSyncPayload => ({
  ...payload,
  officerCharacter: withServerRealm(payload.officerCharacter),
  characters: payload.characters.map(withServerRealm)
});