CREATE TABLE `confessions` (
	`id` text PRIMARY KEY NOT NULL,
	`to_user_id` text NOT NULL,
	`body` text NOT NULL,
	`sender_bucket` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `confessions_to_user_idx` ON `confessions` (`to_user_id`,`created_at`);