const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toValues = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : isRecord(v) ? Object.values(v) : [];

const toNumbers = (v: unknown): number[] =>
  toValues(v).filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0);

const normalizeProfession = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw) || typeof raw.name !== 'string') return undefined;
  return {
    name: raw.name,
    level: raw.level,
    maxLevel: raw.maxLevel,
    recipes: toNumbers(raw.recipes),
    acceptingRequests: raw.acceptingRequests === true,
  };
};

/** Returns undefined when absent so older character records still validate. */
export const normalizeProfessions = (raw: unknown): unknown => {
  if (!isRecord(raw)) return undefined;
  return {
    updatedAt: raw.updatedAt,
    primary: toValues(raw.primary).map(normalizeProfession).filter(isRecord),
  };
};

const normalizeGoal = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw)) return undefined;
  const goal: Record<string, unknown> = { itemId: raw.itemId, itemLink: raw.itemLink ?? '' };
  if (typeof raw.note === 'string' && raw.note.trim() !== '') goal.note = raw.note.trim().slice(0, 80);
  return goal;
};

export const normalizeGearGoals = (raw: unknown): unknown => {
  if (!isRecord(raw)) return undefined;
  return {
    updatedAt: raw.updatedAt,
    goals: toValues(raw.goals).map(normalizeGoal).filter(isRecord).slice(0, 5),
  };
};
