import { z } from "zod";

export const EquipmentSlotIdSchema = z.number().int().min(1).max(19);

export type EquipmentSlotId = z.infer<typeof EquipmentSlotIdSchema>;

export const EquippedItemSchema = z.object({
  slotId: EquipmentSlotIdSchema,
  itemLink: z.string(),
  itemId: z.number().int().nonnegative()
}).strict();

export type EquippedItem = z.infer<typeof EquippedItemSchema>;

export const PlayerGearSchema = z.object({
  items: z.array(EquippedItemSchema),
  updatedAt: z.number().int().nonnegative()
}).strict();

export type PlayerGear = z.infer<typeof PlayerGearSchema>;
