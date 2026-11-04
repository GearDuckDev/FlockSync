CREATE TABLE `loot_session_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`revision` integer NOT NULL,
	`actor_id` text NOT NULL,
	`actor_username` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`before_json` text,
	`after_json` text NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `loot_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loot_session_audit_revision_idx` ON `loot_session_audit` (`session_id`,`revision`);--> statement-breakpoint
CREATE TABLE `loot_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`instance_name` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`tiers_json` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `loot_sessions_schedule_idx` ON `loot_sessions` (`scheduled_at`,`id`);