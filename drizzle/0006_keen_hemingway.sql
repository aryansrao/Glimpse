CREATE TABLE `confession_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`confession_id` text NOT NULL,
	`from_owner` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `confession_messages_confession_idx` ON `confession_messages` (`confession_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dm_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dm_reactions_pair_idx` ON `dm_reactions` (`message_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `dm_reactions_message_idx` ON `dm_reactions` (`message_id`);--> statement-breakpoint
ALTER TABLE `confessions` ADD `sender_user_id` text;--> statement-breakpoint
ALTER TABLE `confessions` ADD `last_message_at` integer;--> statement-breakpoint
CREATE INDEX `confessions_sender_idx` ON `confessions` (`sender_user_id`);--> statement-breakpoint
ALTER TABLE `dm_messages` ADD `reply_to_id` text;--> statement-breakpoint
ALTER TABLE `dm_threads` ADD `state` text DEFAULT 'accepted' NOT NULL;--> statement-breakpoint
ALTER TABLE `dm_threads` ADD `initiator_id` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `max_participants` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `media_type` text DEFAULT 'image' NOT NULL;