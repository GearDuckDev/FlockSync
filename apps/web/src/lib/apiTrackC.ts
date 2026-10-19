import {
  AttendanceRecordSchema,
  LootRecordSchema,
  OfficerTaskSchema,
  type AttendanceRecord,
  type LootRecord,
  type OfficerTask,
  type OfficerTaskInput,
} from '@flocksync/shared-types';
import { z } from 'zod';
import { request } from './api';

export const fetchLoot = async (token: string): Promise<LootRecord[]> =>
  z.array(LootRecordSchema).parse(await request('/api/ledger/loot?limit=5000', {}, token));

export const fetchAttendance = async (token: string): Promise<AttendanceRecord[]> =>
  z.array(AttendanceRecordSchema).parse(await request('/api/ledger/attendance?limit=5000', {}, token));

export const fetchTasks = async (token: string): Promise<OfficerTask[]> =>
  z.array(OfficerTaskSchema).parse(await request('/api/tasks', {}, token));

export const createTask = async (token: string, input: OfficerTaskInput): Promise<OfficerTask> =>
  OfficerTaskSchema.parse(await request('/api/tasks', { method: 'POST', body: JSON.stringify(input) }, token));

export const updateTask = async (token: string, id: string, input: OfficerTaskInput): Promise<OfficerTask> =>
  OfficerTaskSchema.parse(
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }, token),
  );

export const deleteTask = async (token: string, id: string): Promise<void> => {
  await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
};
