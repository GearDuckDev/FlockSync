CREATE TABLE `character_ownership_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`character_guid` text NOT NULL,
	`character_name` text NOT NULL,
	`guild_name` text NOT NULL,
	`guild_realm` text NOT NULL,
	`previous_user_id` text,
	`previous_username` text,
	`user_id` text,
	`username` text,
	`actor_id` text NOT NULL,
	`actor_username` text NOT NULL,
	`changed_at` integer NOT NULL,
	`reason` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_ownerships` (
	`character_guid` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`guild_name` text NOT NULL,
	`guild_realm` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_guid`) REFERENCES `characters`(`guid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
