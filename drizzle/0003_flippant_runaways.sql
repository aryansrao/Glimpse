CREATE TABLE `post_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_comments_post_idx` ON `post_comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_likes_pair_idx` ON `post_likes` (`post_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `post_likes_user_idx` ON `post_likes` (`user_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`body` text,
	`media_url` text,
	`media_type` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `posts_user_idx` ON `posts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `posts_created_idx` ON `posts` (`created_at`);