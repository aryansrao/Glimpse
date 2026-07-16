CREATE TABLE `comment_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_votes_pair_idx` ON `comment_votes` (`comment_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `post_media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`file_name` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_media_post_idx` ON `post_media` (`post_id`,`position`);--> statement-breakpoint
ALTER TABLE `post_comments` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `post_comments` ADD `score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `post_comments_parent_idx` ON `post_comments` (`parent_id`);