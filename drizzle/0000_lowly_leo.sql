CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`topic` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`owner_user_id` text NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_rooms_slug_idx` ON `chat_rooms` (`slug`);--> statement-breakpoint
CREATE INDEX `chat_rooms_visibility_idx` ON `chat_rooms` (`visibility`);--> statement-breakpoint
CREATE TABLE `queue_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`peer_id` text NOT NULL,
	`display_name` text NOT NULL,
	`user_id` text,
	`mode` text DEFAULT 'video' NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`matched_with_peer_id` text,
	`matched_with_name` text,
	`is_initiator` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `queue_status_mode_idx` ON `queue_entries` (`status`,`mode`);--> statement-breakpoint
CREATE TABLE `room_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`code` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`expires_at` integer,
	`max_uses` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_invites_code_idx` ON `room_invites` (`code`);--> statement-breakpoint
CREATE INDEX `room_invites_room_idx` ON `room_invites` (`room_id`);--> statement-breakpoint
CREATE TABLE `room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text,
	`is_owner` integer DEFAULT false NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_members_room_user_idx` ON `room_members` (`room_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `room_members_user_idx` ON `room_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `room_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text,
	`media_url` text,
	`media_type` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_messages_room_idx` ON `room_messages` (`room_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `room_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_roles_room_idx` ON `room_roles` (`room_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'video' NOT NULL,
	`host_token` text NOT NULL,
	`host_peer_id` text NOT NULL,
	`host_name` text NOT NULL,
	`host_user_id` text,
	`guest_peer_id` text,
	`guest_name` text,
	`guest_user_id` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_status_idx` ON `rooms` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`bio` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`avatar_webp_base64` text,
	`discord_id` text,
	`github_id` text,
	`is_public` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_idx` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_idx` ON `users` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_idx` ON `users` (`github_id`);