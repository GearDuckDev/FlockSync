import { OfficerSyncPayloadSchema } from '@flocksync/shared-types';
import type { OfficerSyncPayload } from '@flocksync/shared-types';
export { serializeServerReturnToLua } from './luaReturn';
import { luaToJs, parseLuaAssignment, LuaParseError } from './luaTable';
import { normalizeAvailability, normalizeLockouts } from './luaTracking';
import { normalizeGearGoals, normalizeProfessions } from './luaProfessions';
import { normalizeAttunements, normalizeLedger } from './luaLedger';

export type ParseResult =
  | { ok: true; payload: OfficerSyncPayload }
  | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const CHARACTER_KEYS = [
  'guid', 'name', 'realm', 'classId', 'level', 'mainCharacterGuid', 'mainCharacterName',
  'isActive', 'role', 'gear', 'availability', 'lockouts', 'professions', 'gearGoals', 'attunements', 'lastSeenAt',
] as const;

const pick = (src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
};

const toCharacter = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const character = pick(raw, CHARACTER_KEYS);
  if (typeof character.isActive !== 'boolean') character.isActive = true;
  for (const [key, normalize] of [
    ['availability', normalizeAvailability],
    ['lockouts', normalizeLockouts],
    ['professions', normalizeProfessions],
    ['gearGoals', normalizeGearGoals],
    ['attunements', normalizeAttunements],
  ] as const) {
    const value = normalize(character[key]);
    if (value === undefined) delete character[key];
    else character[key] = value;
  }
  const { role, gear } = character;
  if (isRecord(role)) character.role = pick(role, ['primaryRole', 'offSpecEnabled', 'offSpecRole', 'updatedAt']);
  if (isRecord(gear)) {
    const items = Array.isArray(gear.items) ? gear.items : [];
    character.gear = {
      updatedAt: gear.updatedAt,
      items: items.map((i) => (isRecord(i) ? pick(i, ['slotId', 'itemLink', 'itemId']) : i)),
    };
  }
  return character;
};

const asList = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : isRecord(v) ? Object.values(v) : [];

/** FlockSyncDB stores officerCharacter as "Name (Realm)"; resolve it to a full Character. */
const resolveOfficer = (label: unknown, characters: Record<string, unknown>[]): unknown => {
  const byLabel = characters.find((c) => `${String(c.name)} (${String(c.realm)})` === label);
  if (byLabel) return byLabel;
  const sorted = [...characters].sort((a, b) => Number(b.lastSeenAt ?? 0) - Number(a.lastSeenAt ?? 0));
  return sorted[0];
};

export const parseFlockSyncLua = (source: string): ParseResult => {
  let db: unknown;
  try {
    db = luaToJs(parseLuaAssignment(source, 'FlockSyncDB'));
  } catch (err) {
    const msg = err instanceof LuaParseError ? err.message : String(err);
    return { ok: false, error: `Lua parse failed: ${msg}` };
  }
  if (!isRecord(db)) return { ok: false, error: 'FlockSyncDB is empty or not a table' };

  const characters = asList(db.characters).map(toCharacter).filter(isRecord);
  if (characters.length === 0) return { ok: false, error: 'No tracked characters in FlockSyncDB yet' };

  const result = OfficerSyncPayloadSchema.safeParse({
    addonVersion: db.addonVersion,
    officerCharacter: resolveOfficer(db.officerCharacter, characters),
    exportedAt: db.exportedAt,
    characters,
    ...normalizeLedger(db.guildLedger),
  });
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 5);
    return { ok: false, error: `Validation failed: ${issues.join('; ')}` };
  }
  return { ok: true, payload: result.data };
};
