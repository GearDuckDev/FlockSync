import {
  LoginResponseSchema,
  ServerReturnPayloadSchema,
  type LoginResponse,
  type OfficerSyncPayload,
  type ServerReturnPayload,
} from '@flocksync/shared-types';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const base = (url: string): string => url.trim().replace(/\/+$/, '');

const request = async (url: string, init: RequestInit): Promise<ApiResult<unknown>> => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'Set a valid HTTP or HTTPS API URL in settings before logging in or syncing.' };
    }
  } catch {
    return { ok: false, error: 'Set a valid HTTP or HTTPS API URL in settings before logging in or syncing.' };
  }
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : res.statusText;
      return { ok: false, error: `HTTP ${res.status}: ${msg}` };
    }
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
};

export const apiLogin = async (apiBaseUrl: string, email: string, password: string): Promise<ApiResult<LoginResponse>> => {
  const res = await request(`${base(apiBaseUrl)}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return res;
  const parsed = LoginResponseSchema.safeParse(res.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'Unexpected login response from server' };
};

export const apiSync = async (
  apiBaseUrl: string,
  token: string,
  payload: OfficerSyncPayload,
): Promise<ApiResult<ServerReturnPayload>> => {
  const res = await request(`${base(apiBaseUrl)}/api/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...payload, includeHelperReleases: true }),
  });
  if (!res.ok) return res;
  const parsed = ServerReturnPayloadSchema.safeParse(res.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'Unexpected sync response from server' };
};
