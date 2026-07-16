CREATE TABLE `dm_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text,
	`media_url` text,
	`media_type` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dm_messages_thread_idx` ON `dm_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dm_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`last_message_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dm_threads_pair_idx` ON `dm_threads` (`user_a_id`,`user_b_id`);--> statement-breakpoint
CREATE INDEX `dm_threads_user_b_idx` ON `dm_threads` (`user_b_id`);--> statement-breakpoint
CREATE TABLE `email_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_otps_user_idx` ON `email_otps` (`user_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_pair_idx` ON `follows` (`follower_id`,`following_id`);--> statement-breakpoint
CREATE INDEX `follows_following_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `recent_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`mode` text DEFAULT 'video' NOT NULL,
	`ended_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recent_calls_user_a_idx` ON `recent_calls` (`user_a_id`,`ended_at`);--> statement-breakpoint
CREATE INDEX `recent_calls_user_b_idx` ON `recent_calls` (`user_b_id`,`ended_at`);--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`media_url` text NOT NULL,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stories_user_idx` ON `stories` (`user_id`);--> statement-breakpoint
CREATE INDEX `stories_expires_idx` ON `stories` (`expires_at`);--> statement-breakpoint
CREATE TABLE `story_views` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`viewed_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_views_pair_idx` ON `story_views` (`story_id`,`viewer_id`);--> statement-breakpoint
ALTER TABLE `queue_entries` ADD `group_size` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `queue_entries` ADD `tags` text DEFAULT '[]' NOT NULL;