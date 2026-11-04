import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const lootSessions = sqliteTable("loot_sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  instanceName: text("instance_name").notNull(),
  scheduledAt: integer("scheduled_at").notNull(),
  tiersJson: text("tiers_json").notNull(),
  status: text("status", { enum: ["DRAFT"] }).notNull(),
  revision: integer("revision").notNull(),
  // Keep provenance after an account is deleted; these are historical actor IDs, not ownership.
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
}, (table) => [index("loot_sessions_schedule_idx").on(table.scheduledAt, table.id)]);

export const lootSessionAudit = sqliteTable("loot_session_audit", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => lootSessions.id),
  revision: integer("revision").notNull(),
  actorId: text("actor_id").notNull(),
  actorUsername: text("actor_username").notNull(),
  action: text("action", { enum: ["CREATED", "UPDATED"] }).notNull(),
  reason: text("reason").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json").notNull(),
  timestamp: integer("timestamp").notNull()
}, (table) => [uniqueIndex("loot_session_audit_revision_idx").on(table.sessionId, table.revision)]);
