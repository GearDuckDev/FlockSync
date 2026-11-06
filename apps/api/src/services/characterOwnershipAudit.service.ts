import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { characterOwnershipAudit, characters, guildIdentity, groupOwnerships, users } from "../db/schema.js";
import { effectiveOwnerships } from "./groupOwnership.service.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const auditOwnershipDeletion = (
  tx: Transaction, target: { userId: string } | { characterGuid: string }, actorId: string
): void => {
  const rows = effectiveOwnerships().filter((row) => "userId" in target
    ? row.userId === target.userId : row.characterGuid === target.characterGuid);
  if ("characterGuid" in target) {
    tx.delete(groupOwnerships).where(eq(groupOwnerships.groupKey, target.characterGuid)).run();
  }
  if (rows.length === 0) return;
  const actor = tx.select().from(users).where(eq(users.id, actorId)).get();
  const guild = tx.select().from(guildIdentity).get();
  if (!actor || !guild) throw new Error("Ownership deletion requires an existing acting user and guild");
  for (const row of rows) {
    const character = tx.select().from(characters).where(eq(characters.guid, row.characterGuid)).get();
    const owner = tx.select().from(users).where(eq(users.id, row.userId)).get();
    if (!character || !owner) throw new Error("Character ownership has an invalid reference");
    tx.insert(characterOwnershipAudit).values({
      id: randomUUID(), characterGuid: row.characterGuid, characterName: character.name,
      guildName: guild.name, guildRealm: guild.realm,
      previousUserId: row.userId, previousUsername: owner.username, userId: null, username: null,
      actorId: actor.id, actorUsername: actor.username, changedAt: Math.floor(Date.now() / 1000),
      reason: "userId" in target ? "USER_DELETED" : "CHARACTER_DELETED"
    }).run();
  }
};
