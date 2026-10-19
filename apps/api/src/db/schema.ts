import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["MEMBER", "OFFICER", "ADMIN"] }).notNull(),
  createdAt: integer("created_at").notNull()
});

export const characters = sqliteTable("characters", {
  guid: text("guid").primaryKey(),
  name: text("name").notNull(),
  realm: text("realm").notNull(),
  classId: integer("class_id").notNull(),
  level: integer("level").notNull(),
  mainCharacterGuid: text("main_character_guid"),
  mainCharacterName: text("main_character_name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // True only when isActive was cleared by the 30-day inactivity rule (not a manual cull).
  autoStale: integer("auto_stale", { mode: "boolean" }).notNull().default(false),
  primaryRole: text("primary_role", { enum: ["TANK", "HEALER", "DPS"] }).notNull(),
  offSpecEnabled: integer("off_spec_enabled", { mode: "boolean" }).notNull(),
  offSpecRole: text("off_spec_role", { enum: ["TANK", "HEALER", "DPS"] }),
  roleUpdatedAt: integer("role_updated_at").notNull(),
  gearJson: text("gear_json").notNull(),
  gearUpdatedAt: integer("gear_updated_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  availabilityJson: text("availability_json").notNull().default("null"),
  availabilityUpdatedAt: integer("availability_updated_at").notNull().default(0),
  lockoutsJson: text("lockouts_json").notNull().default("null"),
  lockoutsUpdatedAt: integer("lockouts_updated_at").notNull().default(0),
  professionsJson: text("professions_json").notNull().default("null"),
  professionsUpdatedAt: integer("professions_updated_at").notNull().default(0),
  gearGoalsJson: text("gear_goals_json").notNull().default("null"),
  gearGoalsUpdatedAt: integer("gear_goals_updated_at").notNull().default(0),
  attunementsJson: text("attunements_json").notNull().default("null"),
  attunementsUpdatedAt: integer("attunements_updated_at").notNull().default(0),
  updatedByOfficerId: text("updated_by_officer_id")
    .notNull()
    .references(() => users.id)
});

export const raidTeams = sqliteTable("raid_teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teamType: text("team_type", { enum: ["PVP", "DUNGEON", "RAID"] }).notNull().default("RAID"),
  instanceName: text("instance_name").notNull(),
  raidSize: integer("raid_size").notNull(),
  scheduledDay: text("scheduled_day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  timezone: text("timezone").notNull(),
  targetTanks: integer("target_tanks").notNull(),
  targetHealers: integer("target_healers").notNull(),
  targetDps: integer("target_dps").notNull(),
  assignmentsJson: text("assignments_json").notNull().default("[]"),
  benchGuidsJson: text("bench_guids_json").notNull().default("[]"),
  updatedAt: integer("updated_at").notNull()
});

export const playerAliases = sqliteTable("player_aliases", {
  key: text("key").primaryKey(),
  alias: text("alias").notNull()
});

// Permanently deleted characters; sync ignores them unless seen again after deletion.
export const deletedCharacters = sqliteTable("deleted_characters", {
  guid: text("guid").primaryKey(),
  deletedAt: integer("deleted_at").notNull()
});

export const lootHistory = sqliteTable("loot_history", {
  id: text("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  itemLink: text("item_link").notNull(),
  recipientGuid: text("recipient_guid").notNull(),
  recipientName: text("recipient_name").notNull(),
  instanceName: text("instance_name").notNull(),
  bossName: text("boss_name"),
  timestamp: integer("timestamp").notNull()
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  instanceName: text("instance_name").notNull(),
  timestamp: integer("timestamp").notNull(),
  rosterGuidsJson: text("roster_guids_json").notNull().default("[]"),
  benchGuidsJson: text("bench_guids_json").notNull().default("[]")
});

export const officerTasks = sqliteTable("officer_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignedOfficerId: text("assigned_officer_id"),
  relatedCharacterGuid: text("related_character_guid"),
  status: text("status", { enum: ["OPEN", "IN_PROGRESS", "COMPLETED"] }).notNull().default("OPEN"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
  updatedCharacters: many(characters)
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  updatedByOfficer: one(users, {
    fields: [characters.updatedByOfficerId],
    references: [users.id]
  })
}));
