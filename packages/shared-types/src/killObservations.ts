import { z } from "zod";

const Text = z.string().min(1).max(320).refine(
  (value) => !/[\u0000-\u001f\u007f|]/u.test(value), "Unsupported character"
);
const Epoch = z.number().int().nonnegative();
export const KillObservationSchema = z.object({
  id: Text.max(240),
  kind: z.enum(["SIGHTING", "KILL", "DEATH"]),
  name: Text, realm: Text, targetGuid: Text, targetCreatedAt: Epoch,
  timestamp: Epoch, zone: Text, reporterGuid: Text, reporter: Text,
  actorGuid: Text.optional(), actor: Text.optional(),
  victimGuid: Text.optional(), victim: Text.optional()
}).strict().refine((value) => value.timestamp >= value.targetCreatedAt
  && (value.kind === "SIGHTING"
    ? value.actorGuid === undefined && value.actor === undefined
      && value.victimGuid === undefined && value.victim === undefined
    : !!value.actorGuid && !!value.actor && !!value.victimGuid && !!value.victim
      && (value.kind === "KILL" ? value.victimGuid === value.targetGuid : value.actorGuid === value.targetGuid)),
  "Invalid observation participants");
export type KillObservation = z.infer<typeof KillObservationSchema>;
export const KillObservationsSchema = z.array(KillObservationSchema).max(10000);
