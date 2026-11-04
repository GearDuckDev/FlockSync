import { z } from "zod";

const EpochSchema = z.number().int().min(0).max(253402300799);

export const LootReservationTierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  picks: z.number().int().min(1).max(20)
}).strict();
export type LootReservationTier = z.infer<typeof LootReservationTierSchema>;

const TiersSchema = z.array(LootReservationTierSchema).min(1).max(10)
  .superRefine((tiers, context) => {
    const names = new Set<string>();
    tiers.forEach((tier, index) => {
      const name = tier.name.toLowerCase();
      if (names.has(name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "name"],
          message: "Tier names must be unique"
        });
      }
      names.add(name);
    });
  });

const draftFields = {
  name: z.string().trim().min(1).max(80),
  instanceName: z.string().trim().min(1).max(80),
  scheduledAt: EpochSchema,
  tiers: TiersSchema
};

export const LootSessionDraftInputSchema = z.object(draftFields).strict();
export type LootSessionDraftInput = z.infer<typeof LootSessionDraftInputSchema>;

export const LootSessionDraftUpdateSchema = LootSessionDraftInputSchema.extend({
  expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(3).max(500)
});
export type LootSessionDraftUpdate = z.infer<typeof LootSessionDraftUpdateSchema>;

export const LootSessionDraftSchema = z.object({
  id: z.string().uuid(),
  ...draftFields,
  status: z.literal("DRAFT"),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  createdBy: z.string().min(1),
  createdAt: EpochSchema,
  updatedAt: EpochSchema
}).strict();
export type LootSessionDraft = z.infer<typeof LootSessionDraftSchema>;

export const LootSessionIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const LootSessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();
export type LootSessionListQuery = z.infer<typeof LootSessionListQuerySchema>;

export const LootSessionAuditSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  actorId: z.string().min(1),
  actorUsername: z.string().min(1),
  action: z.enum(["CREATED", "UPDATED"]),
  reason: z.string().min(1).max(500),
  before: LootSessionDraftSchema.nullable(),
  after: LootSessionDraftSchema,
  timestamp: EpochSchema
}).strict();
export type LootSessionAudit = z.infer<typeof LootSessionAuditSchema>;
