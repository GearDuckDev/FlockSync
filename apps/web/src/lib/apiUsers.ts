import {
  LoginResponseSchema,
  ManagedUserSchema,
  type AuthUserRole,
  type CreateUserAdmin,
  type LoginResponse,
  type ManagedUser,
  type RegisterRequest,
} from '@flocksync/shared-types';
import { z } from 'zod';
import { request } from './api';

export const register = async (input: RegisterRequest): Promise<LoginResponse> =>
  LoginResponseSchema.parse(await request('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }));

export const fetchUsers = async (token: string): Promise<ManagedUser[]> =>
  z.array(ManagedUserSchema).parse(await request('/api/users', {}, token));

export const createUser = async (token: string, input: CreateUserAdmin): Promise<ManagedUser> =>
  ManagedUserSchema.parse(await request('/api/users', { method: 'POST', body: JSON.stringify(input) }, token));

export const updateUserRole = async (token: string, id: string, role: AuthUserRole): Promise<ManagedUser> =>
  ManagedUserSchema.parse(
    await request(`/api/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, token),
  );

export const deleteUser = async (token: string, id: string): Promise<void> => {
  await request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
};

export const updateUsername = async (token: string, id: string, username: string): Promise<ManagedUser> =>
  ManagedUserSchema.parse(
    await request(`/api/users/${encodeURIComponent(id)}/username`, {
      method: 'PATCH', body: JSON.stringify({ username }),
    }, token),
  );
