import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { hash } from "bcryptjs";
import { env } from "../config/env.js";
import { db } from "./index.js";
import { users } from "./schema.js";

export const seedInitialAdmin = async (): Promise<void> => {
  if (!env.INITIAL_ADMIN_EMAIL || !env.INITIAL_ADMIN_PASSWORD) {
    return;
  }

  const [userCount] = await db.select({ count: count() }).from(users);
  if (userCount.count > 0) {
    return;
  }

  const email = env.INITIAL_ADMIN_EMAIL;
  const passwordHash = await hash(env.INITIAL_ADMIN_PASSWORD, 12);
  await db.insert(users).values({
    id: randomUUID(),
    email,
    username: email.split("@")[0] ?? email,
    passwordHash,
    role: "ADMIN",
    createdAt: Math.floor(Date.now() / 1000)
  });
};
