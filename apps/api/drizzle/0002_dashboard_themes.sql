CREATE TABLE `theme_defaults` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_themes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`theme_json` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
