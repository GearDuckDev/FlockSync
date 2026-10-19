CREATE TABLE IF NOT EXISTS `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_name` text NOT NULL,
	`timestamp` integer NOT NULL,
	`roster_guids_json` text DEFAULT '[]' NOT NULL,
	`bench_guids_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `characters` (
	`guid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`realm` text NOT NULL,
	`class_id` integer NOT NULL,
	`level` integer NOT NULL,
	`main_character_guid` text,
	`main_character_name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`primary_role` text NOT NULL,
	`off_spec_enabled` integer NOT NULL,
	`off_spec_role` text,
	`role_updated_at` integer NOT NULL,
	`gear_json` text NOT NULL,
	`gear_updated_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`availability_json` text DEFAULT 'null' NOT NULL,
	`availability_updated_at` integer DEFAULT 0 NOT NULL,
	`lockouts_json` text DEFAULT 'null' NOT NULL,
	`lockouts_updated_at` integer DEFAULT 0 NOT NULL,
	`professions_json` text DEFAULT 'null' NOT NULL,
	`professions_updated_at` integer DEFAULT 0 NOT NULL,
	`gear_goals_json` text DEFAULT 'null' NOT NULL,
	`gear_goals_updated_at` integer DEFAULT 0 NOT NULL,
	`attunements_json` text DEFAULT 'null' NOT NULL,
	`attunements_updated_at` integer DEFAULT 0 NOT NULL,
	`updated_by_officer_id` text NOT NULL,
	FOREIGN KEY (`updated_by_officer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deleted_characters` (
	`guid` text PRIMARY KEY NOT NULL,
	`deleted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `loot_history` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` integer NOT NULL,
	`item_link` text NOT NULL,
	`recipient_guid` text NOT NULL,
	`recipient_name` text NOT NULL,
	`instance_name` text NOT NULL,
	`boss_name` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `officer_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assigned_officer_id` text,
	`related_character_guid` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `player_aliases` (
	`key` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `raid_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team_type` text DEFAULT 'RAID' NOT NULL,
	`instance_name` text NOT NULL,
	`raid_size` integer NOT NULL,
	`scheduled_day` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`timezone` text NOT NULL,
	`target_tanks` integer NOT NULL,
	`target_healers` integer NOT NULL,
	`target_dps` integer NOT NULL,
	`assignments_json` text DEFAULT '[]' NOT NULL,
	`bench_guids_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);