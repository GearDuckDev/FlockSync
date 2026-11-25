// WoW Forever clients report no realm name; every player GUID ("Player-6930-0ABC1234")
// still carries the numeric server id, which is the canonical realm identity.
const PLAYER_GUID_SERVER = /^Player-(\d{1,10})-/u;
const SERVER_REALM = /^\d{1,10}$/u;

export const serverIdFromGuid = (guid: string): string | undefined =>
  PLAYER_GUID_SERVER.exec(guid)?.[1];

export const isServerRealm = (realm: string): boolean => SERVER_REALM.test(realm);

export const formatRealm = (realm: string): string =>
  isServerRealm(realm) ? `Server ${realm}` : realm;
