CREATE TABLE `kill_observations` (
	`guild_key` text NOT NULL,
	`id` text NOT NULL,
	`target_key` text NOT NULL,
	`kind` text NOT NULL,
	`timestamp` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`guild_key`, `id`)
);
