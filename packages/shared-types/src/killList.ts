import { z } from "zod";

const Epoch = z.number().int().nonnegative();
const Text = z.string().trim().min(1).max(80).refine(
  (value) => !/[\u0000-\u001f\u007f|]/u.test(value), "Unsupported character"
);
const KillTargetName = Text.refine((value) => !/[\[\]]/u.test(value), "Unsupported character");
export const KillNoteSchema = z.string().refine(
  (value) => Array.from(value).length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
  "Notes allow up to 500 characters"
);
export const MAX_SHARED_KILL_ENTRIES = 5000;
export const SharedKillEntrySchema = z.object({
  name: Text, realm: Text, note: KillNoteSchema, author: Text,
  authorGuid: Text, actorGuid: Text, createdAt: Epoch, updatedAt: Epoch, deleted: z.boolean()
}).strict().refine((entry) => entry.createdAt <= entry.updatedAt && (!entry.deleted || entry.note === ""),
  "Invalid creation/removal metadata");
export type SharedKillEntry = z.infer<typeof SharedKillEntrySchema>;
export const SharedKillListSchema = z.array(SharedKillEntrySchema).max(MAX_SHARED_KILL_ENTRIES);
export const KillCreateRequestSchema = z.object({
  name: KillTargetName, note: KillNoteSchema
}).strict();
export const KillEditRequestSchema = z.object({
  name: Text, realm: Text, expectedUpdatedAt: Epoch, note: KillNoteSchema
}).strict();
export const KillRemoveRequestSchema = z.object({
  name: Text, realm: Text, expectedUpdatedAt: Epoch
}).strict();
