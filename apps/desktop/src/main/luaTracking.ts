const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const pick = (src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
};

/** Lua tables parse to [] when empty and to objects when keyed; always return a list of records. */
const toList = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : isRecord(v) ? Object.values(v) : []).filter(isRecord);

const DAY_KEYS = ['day', 'status', 'startTime', 'endTime'] as const;
const LOCKOUT_KEYS = [
  'instanceName', 'instanceId', 'difficultyId', 'resetAt', 'locked', 'extended',
  'numEncounters', 'completedEncounters',
] as const;

/** Returns undefined when absent or empty so older character records still validate. */
export const normalizeAvailability = (raw: unknown): unknown => {
  if (!isRecord(raw) || typeof raw.timezone !== 'string') return undefined;
  const out = pick(raw, ['timezone', 'notes', 'updatedAt']);
  if (out.notes === '') delete out.notes;
  out.schedule = toList(raw.schedule).map((d) => pick(d, DAY_KEYS));
  return out;
};

export const normalizeLockouts = (raw: unknown): unknown => {
  if (!isRecord(raw)) return undefined;
  return {
    updatedAt: raw.updatedAt,
    lockouts: toList(raw.lockouts).map((l) => pick(l, LOCKOUT_KEYS)),
  };
};
