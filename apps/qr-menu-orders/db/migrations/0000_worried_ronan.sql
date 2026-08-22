CREATE TABLE `dining_table` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`label` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dining_table_code_unique` ON `dining_table` (`code`);--> statement-breakpoint
CREATE INDEX `dining_table_restaurant_idx` ON `dining_table` (`restaurant_id`);--> statement-breakpoint
CREATE TABLE `menu_category` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_category_restaurant_idx` ON `menu_category` (`restaurant_id`,`position`);--> statement-breakpoint
CREATE TABLE `menu_item` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` text NOT NULL,
	`photo_url` text,
	`available` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `menu_category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_item_restaurant_idx` ON `menu_item` (`restaurant_id`);--> statement-breakpoint
CREATE INDEX `menu_item_category_idx` ON `menu_item` (`category_id`,`position`);--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`menu_item_id` text,
	`name` text NOT NULL,
	`price` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_item`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_item` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`table_id` text NOT NULL,
	`memo_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` text NOT NULL,
	`pay_to_address` text NOT NULL,
	`tx_hash` text,
	`ledger` integer,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `dining_table`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_memo_id_unique` ON `orders` (`memo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_tx_hash_unique` ON `orders` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `orders_board_idx` ON `orders` (`restaurant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_paid_at_idx` ON `orders` (`restaurant_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `restaurant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_address` text NOT NULL,
	`admin_token_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurant_slug_unique` ON `restaurant` (`slug`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`restaurant_id` text PRIMARY KEY NOT NULL,
	`last_cursor` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_restaurant_idx` ON `sync_state` (`restaurant_id`);