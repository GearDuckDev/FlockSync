import { eq } from "drizzle-orm";
import type { PlayerAlias } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { playerAliases } from "../db/schema.js";

export const listAliases = (): PlayerAlias[] => db.select().from(playerAliases).all();

export const setAlias = (key: string, alias: string): PlayerAlias => {
  db.insert(playerAliases).values({ key, alias })
    .onConflictDoUpdate({ target: playerAliases.key, set: { alias } }).run();
  return { key, alias };
};

export const clearAlias = (key: string): boolean =>
  db.delete(playerAliases).where(eq(playerAliases.key, key)).run().changes > 0;
