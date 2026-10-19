import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { OfficerTaskSchema } from "@flocksync/shared-types";
import type { OfficerTask, OfficerTaskInput } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { officerTasks } from "../db/schema.js";

type TaskRow = typeof officerTasks.$inferSelect;

const toTask = (row: TaskRow): OfficerTask => OfficerTaskSchema.parse({
  id: row.id,
  title: row.title,
  ...(row.description === null ? {} : { description: row.description }),
  ...(row.assignedOfficerId === null ? {} : { assignedOfficerId: row.assignedOfficerId }),
  ...(row.relatedCharacterGuid === null ? {} : { relatedCharacterGuid: row.relatedCharacterGuid }),
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const now = (): number => Math.floor(Date.now() / 1000);

const toValues = (input: OfficerTaskInput) => ({
  title: input.title,
  description: input.description ?? null,
  assignedOfficerId: input.assignedOfficerId ?? null,
  relatedCharacterGuid: input.relatedCharacterGuid ?? null,
  status: input.status
});

export const listTasks = (): OfficerTask[] =>
  db.select().from(officerTasks).orderBy(desc(officerTasks.updatedAt)).all().map(toTask);

export const createTask = (input: OfficerTaskInput): OfficerTask => {
  const timestamp = now();
  const row = db.insert(officerTasks)
    .values({ id: randomUUID(), ...toValues(input), createdAt: timestamp, updatedAt: timestamp })
    .returning().get();
  return toTask(row);
};

export const updateTask = (id: string, input: OfficerTaskInput): OfficerTask | undefined => {
  const row = db.update(officerTasks)
    .set({ ...toValues(input), updatedAt: now() })
    .where(eq(officerTasks.id, id))
    .returning().get();
  return row ? toTask(row) : undefined;
};

export const deleteTask = (id: string): boolean =>
  db.delete(officerTasks).where(eq(officerTasks.id, id)).run().changes > 0;
