const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toValues = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : isRecord(v) ? Object.values(v) : [];

const toStrings = (v: unknown): string[] =>
  toValues(v).filter((s): s is string => typeof s === 'string' && s !== '');

const normalizeStep = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw)) return undefined;
  return { stepId: raw.stepId, questId: raw.questId, name: raw.name, completed: raw.completed === true };
};

const normalizeChain = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw)) return undefined;
  return {
    chainId: raw.chainId,
    name: raw.name,
    steps: toValues(raw.steps).map(normalizeStep).filter(isRecord),
    isFullyAttuned: raw.isFullyAttuned === true,
    updatedAt: raw.updatedAt,
  };
};

/** Returns undefined when absent so older character records still validate. */
export const normalizeAttunements = (raw: unknown): unknown => {
  if (raw === undefined || raw === null) return undefined;
  return toValues(raw).map(normalizeChain).filter(isRecord);
};

const normalizeLoot = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw)) return undefined;
  const record: Record<string, unknown> = {
    id: raw.id,
    itemId: raw.itemId,
    itemLink: raw.itemLink ?? '',
    recipientGuid: raw.recipientGuid ?? '',
    recipientName: raw.recipientName,
    instanceName: raw.instanceName,
    timestamp: raw.timestamp,
  };
  if (typeof raw.bossName === 'string' && raw.bossName !== '') record.bossName = raw.bossName;
  return record;
};

const normalizeAttendance = (raw: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(raw)) return undefined;
  return {
    id: raw.id,
    instanceName: raw.instanceName,
    timestamp: raw.timestamp,
    rosterGuids: toStrings(raw.rosterGuids),
    benchGuids: toStrings(raw.benchGuids),
  };
};

export const normalizeLedger = (
  raw: unknown,
): { lootHistory: Record<string, unknown>[]; attendanceHistory: Record<string, unknown>[] } => {
  const ledger = isRecord(raw) ? raw : {};
  return {
    lootHistory: toValues(ledger.loot).map(normalizeLoot).filter(isRecord),
    attendanceHistory: toValues(ledger.attendance).map(normalizeAttendance).filter(isRecord),
  };
};
