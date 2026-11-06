CREATE TABLE `shared_kill_targets` (
	`guild_key` text NOT NULL,
	`target_key` text NOT NULL,
	`name` text NOT NULL,
	`realm` text NOT NULL,
	`note` text NOT NULL,
	`author` text NOT NULL,
	`author_guid` text NOT NULL,
	`actor_guid` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted` integer NOT NULL,
	PRIMARY KEY(`guild_key`, `target_key`)
);
