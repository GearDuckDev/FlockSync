import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LootSessionDraftInputSchema, LootSessionDraftUpdateSchema, LootSessionListQuerySchema
} from "@flocksync/shared-types";

const draft = {
  name: "Weekly raid", instanceName: "Example Raid", scheduledAt: 1800000000,
  tiers: [{ name: "First choice", picks: 1 }, { name: "Second choice", picks: 2 }]
};

test("loot draft contracts require explicit bounded, uniquely named tiers", () => {
  assert.equal(LootSessionDraftInputSchema.parse({ ...draft, name: "  Weekly raid  " }).name, draft.name);
  const maximumTiers = Array.from({ length: 10 }, (_, index) => ({ name: `Tier ${index + 1}`, picks: 20 }));
  assert.ok(LootSessionDraftInputSchema.safeParse({ ...draft, tiers: maximumTiers }).success);
  for (const change of [
    { name: " " }, { name: "x".repeat(81) }, { scheduledAt: -1 }, { scheduledAt: 1.5 },
    { scheduledAt: 253402300800 }, { instanceName: "" }, { tiers: [] },
    { tiers: undefined }, { tiers: [...maximumTiers, { name: "Too many", picks: 1 }] },
    { tiers: [{ name: "A", picks: 0 }] }, { tiers: [{ name: "A", picks: 21 }] },
    { tiers: [{ name: "A", picks: 1.5 }] }, { tiers: [{ name: " ", picks: 1 }] },
    { tiers: [{ name: " First ", picks: 1 }, { name: "first", picks: 2 }] },
    { status: "LOCKED" }, { hardReserves: [] }, { createdBy: "spoofed" }
  ]) {
    assert.equal(LootSessionDraftInputSchema.safeParse({ ...draft, ...change }).success, false,
      JSON.stringify(change));
  }
});

test("loot updates require a revision and reason; pagination is bounded", () => {
  const update = { ...draft, expectedRevision: 1, reason: "Changed raid schedule" };
  assert.ok(LootSessionDraftUpdateSchema.safeParse(update).success);
  for (const change of [
    { expectedRevision: undefined }, { expectedRevision: 0 }, { expectedRevision: 1.5 },
    { reason: undefined }, { reason: " " }, { reason: "x".repeat(501) }, { updatedAt: 100 }
  ]) {
    assert.equal(LootSessionDraftUpdateSchema.safeParse({ ...update, ...change }).success, false);
  }
  assert.deepEqual(LootSessionListQuerySchema.parse({}), { limit: 50, offset: 0 });
  assert.deepEqual(LootSessionListQuerySchema.parse({ limit: "100", offset: "2" }), { limit: 100, offset: 2 });
  for (const query of [{ limit: 101 }, { limit: 0 }, { offset: -1 }, { other: true }]) {
    assert.equal(LootSessionListQuerySchema.safeParse(query).success, false);
  }
});
