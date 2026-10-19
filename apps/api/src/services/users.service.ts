import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import {
  ManagedUserSchema,
  type AuthUserRole,
  type ManagedUser
} from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { characters, officerTasks, users } from "../db/schema.js";

const BCRYPT_ROUNDS = 12;

type UserRow = typeof users.$inferSelect;

export type UserMutationResult =
  | { ok: true; user: ManagedUser }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export type UserDeleteResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 404; error: string };

// The root admin is the first account ever created (the seeded INITIAL_ADMIN).
const getRootUserId = (): string | undefined =>
  db.select({ id: users.id }).from(users)
    .orderBy(asc(users.createdAt), sql`${users}.rowid`)
    .limit(1)
    .get()?.id;

const toManagedUser = (row: UserRow, rootId: string | undefined): ManagedUser =>
  ManagedUserSchema.parse({
    id: row.id,
    email: row.email,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt,
    isRootAdmin: row.id === rootId
  });

const emailTaken = (email: string): boolean =>
  db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .get() !== undefined;

const usernameTaken = (username: string, excludingId = ""): boolean =>
  db.select({ id: users.id }).from(users)
    .where(and(sql`lower(${users.username}) = ${username.toLowerCase()}`, ne(users.id, excludingId)))
    .get() !== undefined;

export const findUserById = (id: string): UserRow | undefined =>
  db.select().from(users).where(eq(users.id, id)).get();

export const listUsers = (): ManagedUser[] => {
  const rootId = getRootUserId();
  return db.select().from(users)
    .orderBy(asc(users.createdAt), asc(users.username))
    .all()
    .map((row) => toManagedUser(row, rootId));
};

export const createUser = async (input: {
  email: string;
  username: string;
  password: string;
  role: AuthUserRole;
}): Promise<UserMutationResult> => {
  if (emailTaken(input.email)) {
    return { ok: false, status: 409, error: "An account with that email already exists" };
  }
  if (usernameTaken(input.username)) {
    return { ok: false, status: 409, error: "That username is already taken" };
  }

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);
  if (usernameTaken(input.username)) {
    return { ok: false, status: 409, error: "That username is already taken" };
  }
  const row: UserRow = {
    id: randomUUID(),
    email: input.email,
    username: input.username,
    passwordHash,
    role: input.role,
    createdAt: Math.floor(Date.now() / 1000)
  };

  try {
    db.insert(users).values(row).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { ok: false, status: 409, error: "An account with that email already exists" };
    }
    throw error;
  }
  return { ok: true, user: toManagedUser(row, getRootUserId()) };
};

const countAdmins = (): number =>
  db.select({ total: count() }).from(users).where(eq(users.role, "ADMIN")).get()?.total ?? 0;

export const updateUsername = (
  targetId: string,
  username: string,
  actingUserId: string
): UserMutationResult => {
  const rootId = getRootUserId();
  const actor = findUserById(actingUserId);
  if (targetId !== actingUserId && (actor?.role !== "ADMIN" || actor.id !== rootId)) {
    return { ok: false, status: 403, error: "Only the root admin or account owner can change this username" };
  }
  const target = findUserById(targetId);
  if (!target) return { ok: false, status: 404, error: "User not found" };
  if (usernameTaken(username, targetId)) {
    return { ok: false, status: 409, error: "That username is already taken" };
  }
  db.update(users).set({ username }).where(eq(users.id, targetId)).run();
  return { ok: true, user: toManagedUser({ ...target, username }, rootId) };
};

export const updateUserRole = (
  targetId: string,
  role: AuthUserRole,
  actingUserId: string
): UserMutationResult => {
  const target = findUserById(targetId);
  if (!target) return { ok: false, status: 404, error: "User not found" };

  const rootId = getRootUserId();
  if (target.role === role) return { ok: true, user: toManagedUser(target, rootId) };
  if (target.id === rootId) {
    return { ok: false, status: 403, error: "The root admin's role cannot be changed" };
  }
  if (target.id === actingUserId) {
    return { ok: false, status: 400, error: "You cannot change your own role" };
  }
  if (target.role === "ADMIN" && countAdmins() <= 1) {
    return { ok: false, status: 409, error: "At least one admin account must remain" };
  }

  db.update(users).set({ role }).where(eq(users.id, targetId)).run();
  return { ok: true, user: toManagedUser({ ...target, role }, rootId) };
};

export const deleteUser = (targetId: string, actingUserId: string): UserDeleteResult => {
  const target = findUserById(targetId);
  if (!target) return { ok: false, status: 404, error: "User not found" };
  if (target.id === getRootUserId()) {
    return { ok: false, status: 403, error: "The root admin account cannot be deleted" };
  }
  if (target.id === actingUserId) {
    return { ok: false, status: 400, error: "You cannot delete your own account" };
  }

  db.transaction((tx) => {
    // Synced characters keep a FK to the officer who uploaded them; hand them to the acting admin.
    tx.update(characters)
      .set({ updatedByOfficerId: actingUserId })
      .where(eq(characters.updatedByOfficerId, targetId))
      .run();
    tx.update(officerTasks)
      .set({ assignedOfficerId: null })
      .where(eq(officerTasks.assignedOfficerId, targetId))
      .run();
    tx.delete(users).where(eq(users.id, targetId)).run();
  });
  return { ok: true };
};
