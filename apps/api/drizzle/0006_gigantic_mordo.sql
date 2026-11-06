CREATE TABLE `group_ownerships` (
	`guild_key` text NOT NULL,
	`group_key` text NOT NULL,
	`user_id` text NOT NULL,
	`revision` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`guild_key`, `group_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
