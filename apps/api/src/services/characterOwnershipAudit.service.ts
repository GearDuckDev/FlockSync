import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { characterOwnershipAudit, characterOwnerships, characters, users } from "../db/schema.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const auditOwnershipDeletion = (
  tx: Transaction, target: { userId: string } | { characterGuid: string }, actorId: string
): void => {
  const rows = tx.select().from(characterOwnerships).where("userId" in target
    ? eq(characterOwnerships.userId, target.userId)
    : eq(characterOwnerships.characterGuid, target.characterGuid)).all();
  if (rows.length === 0) return;
  const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
  if (!actor) throw new Error("Ownership deletion requires an existing acting user");
  for (const row of rows) {
    const character = tx.select().from(characters).where(eq(characters.guid, row.characterGuid)).get();
    const owner = tx.select().from(users).where(eq(users.id, row.userId)).get();
    if (!character || !owner) throw new Error("Character ownership has an invalid reference");
    tx.insert(characterOwnershipAudit).values({
      id: randomUUID(), characterGuid: row.characterGuid, characterName: character.name,
      guildName: row.guildName, guildRealm: row.guildRealm,
      previousUserId: row.userId, previousUsername: owner.username, userId: null, username: null,
      actorId: actor.id, actorUsername: actor.username, changedAt: Math.floor(Date.now() / 1000),
      reason: "userId" in target ? "USER_DELETED" : "CHARACTER_DELETED"
    }).run();
  }
};
