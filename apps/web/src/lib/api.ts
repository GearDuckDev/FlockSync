import {
  AuthUserSchema,
  CharacterSchema,
  LoginResponseSchema,
  PlayerAliasSchema,
  RaidTeamSchema,
  type AuthUser,
  type Character,
  type PlayerAlias,
  type RaidTeam,
  type RaidTeamInput,
} from '@flocksync/shared-types';
import { z } from 'zod';

export const TOKEN_KEY = 'flocksync.token';
const configuredBase = import.meta.env['VITE_API_BASE_URL'] as string | undefined;
const legacyOrigin = import.meta.env['VITE_API_URL'] as string | undefined;
const API_BASE_URL = (
  configuredBase ?? (legacyOrigin ? `${legacyOrigin.replace(/\/+$/, '')}/api` : undefined)
  ?? (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const request = async (path: string, init: RequestInit = {}, token?: string): Promise<unknown> => {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path.replace(/^\/api(?=\/|$)/, '')}`, { ...init, headers });
  } catch {
    throw new ApiError(`Cannot reach API at ${API_BASE_URL}`, 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : res.statusText;
    throw new ApiError(msg, res.status);
  }
  return body;
};

export const requestBlob = async (path: string, token: string): Promise<Blob> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path.replace(/^\/api(?=\/|$)/, '')}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(`Cannot reach API at ${API_BASE_URL}`, 0);
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String(body.error) : res.statusText;
    throw new ApiError(message, res.status);
  }
  return res.blob();
};

export const login = async (email: string, password: string): Promise<{ token: string; user: AuthUser }> =>
  LoginResponseSchema.parse(await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));

export const fetchMe = async (token: string): Promise<AuthUser> => {
  const body = await request('/api/auth/me', {}, token);
  const wrapped = z.object({ user: AuthUserSchema }).safeParse(body);
  return wrapped.success ? wrapped.data.user : AuthUserSchema.parse(body);
};

export const fetchRoster = async (token: string): Promise<Character[]> =>
  z.array(CharacterSchema).parse(await request('/api/roster?includeInactive=true', {}, token));

export const setCharacterStatus = async (token: string, guid: string, isActive: boolean): Promise<Character> =>
  CharacterSchema.parse(
    await request(`/api/roster/${encodeURIComponent(guid)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }, token),
  );

export const fetchAliases = async (token: string): Promise<PlayerAlias[]> =>
  z.array(PlayerAliasSchema).parse(await request('/api/aliases', {}, token));

export const saveAlias = async (token: string, key: string, alias: string): Promise<PlayerAlias> =>
  PlayerAliasSchema.parse(await request(`/api/aliases/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ alias }) }, token));

export const removeAlias = async (token: string, key: string): Promise<void> => {
  await request(`/api/aliases/${encodeURIComponent(key)}`, { method: 'DELETE' }, token);
};

export const purgeCharacter = async (token: string, guid: string): Promise<void> => {
  await request(`/api/roster/${encodeURIComponent(guid)}`, { method: 'DELETE' }, token);
};

export const fetchRaids = async (token: string): Promise<RaidTeam[]> =>
  z.array(RaidTeamSchema).parse(await request('/api/raids', {}, token));

export const createRaid = async (token: string, input: RaidTeamInput): Promise<RaidTeam> =>
  RaidTeamSchema.parse(await request('/api/raids', { method: 'POST', body: JSON.stringify(input) }, token));

export const updateRaid = async (token: string, id: string, input: RaidTeamInput): Promise<RaidTeam> =>
  RaidTeamSchema.parse(await request(`/api/raids/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }, token));

export const deleteRaid = async (token: string, id: string): Promise<void> => {
  await request(`/api/raids/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
};
