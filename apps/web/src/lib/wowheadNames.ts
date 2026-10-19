import { z } from 'zod';
import { WOWHEAD_PATH } from './wowhead';

export type EntityKind = 'item' | 'spell';

export interface Entity {
  kind: EntityKind;
  id: number;
}

const STORAGE_KEY = 'flocksync.wowheadNames';
const NameResponseSchema = z.object({ name: z.string().min(1) });
const StoredSchema = z.record(z.string());

export const entityKey = (e: Entity): string => `${e.kind}:${e.id}`;

const loadStored = (): Map<string, string> => {
  try {
    const parsed = StoredSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
    return new Map(parsed.success ? Object.entries(parsed.data) : []);
  } catch {
    return new Map();
  }
};

const names = loadStored();
const failed = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

const persist = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(names)));
  } catch {
    // Names are a cache only; a full or blocked storage just means refetching.
  }
};

export const cachedName = (e: Entity): string | undefined => names.get(entityKey(e));

const fetchName = (e: Entity): Promise<void> => {
  const key = entityKey(e);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = (async (): Promise<void> => {
    try {
      const res = await fetch(`https://nether.wowhead.com/${WOWHEAD_PATH}/tooltip/${e.kind}/${e.id}`);
      if (!res.ok) throw new Error(String(res.status));
      const parsed = NameResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('bad response');
      names.set(key, parsed.data.name);
    } catch {
      failed.add(key);
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
};

const CONCURRENCY = 6;

/** Resolves missing names from Wowhead with a small worker pool; calls onProgress as names arrive. */
export const resolveNames = async (entities: Entity[], onProgress: () => void): Promise<void> => {
  const queue = entities.filter((e) => !names.has(entityKey(e)) && !failed.has(entityKey(e)));
  let sinceSave = 0;
  const worker = async (): Promise<void> => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      await fetchName(e);
      sinceSave += 1;
      if (sinceSave % 10 === 0) onProgress();
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  persist();
  onProgress();
};
