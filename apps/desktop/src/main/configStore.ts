import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { AuthUserSchema } from '@flocksync/shared-types';
import { DEFAULT_API_URL, DEFAULT_WOW_PATH, type AppConfig, type AppSettings } from '../shared/ipc';

export const DEFAULT_GITHUB_REPO = 'GearDuckDev/FlockSync';
const GITHUB_REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const LEGACY_DEFAULT_API_URL = 'https://flocksync.gearduckdev.com';

const StoredSchema = z.object({
  apiBaseUrl: z
    .string()
    .transform((url) => (url === LEGACY_DEFAULT_API_URL ? DEFAULT_API_URL : url))
    .default(DEFAULT_API_URL),
  wowPath: z.string().default(DEFAULT_WOW_PATH),
  token: z.string().nullable().default(null),
  user: AuthUserSchema.nullable().default(null),
  minimizeToTray: z.boolean().catch(true).default(true),
  startOnBoot: z.boolean().catch(true).default(true),
  githubRepo: z.string().regex(GITHUB_REPO_PATTERN).catch(DEFAULT_GITHUB_REPO).default(DEFAULT_GITHUB_REPO),
});
type Stored = z.infer<typeof StoredSchema>;

const filePath = (): string => join(app.getPath('userData'), 'config.json');

export const loadStored = (): Stored => {
  try {
    return StoredSchema.parse(JSON.parse(readFileSync(filePath(), 'utf8')));
  } catch {
    return StoredSchema.parse({});
  }
};

const saveStored = (data: Stored): void => {
  try {
    mkdirSync(dirname(filePath()), { recursive: true });
    writeFileSync(filePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[config] failed to persist config', err);
  }
};

export const updateStored = (patch: Partial<Stored>): Stored => {
  const next: Stored = { ...loadStored(), ...patch };
  saveStored(next);
  return next;
};

export const toAppConfig = (s: Stored): AppConfig => ({ apiBaseUrl: s.apiBaseUrl, wowPath: s.wowPath });

export const toAppSettings = (s: Stored): AppSettings => ({
  minimizeToTray: s.minimizeToTray,
  startOnBoot: s.startOnBoot,
});
