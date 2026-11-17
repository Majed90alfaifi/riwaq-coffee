CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`data` text NOT NULL,
	`position` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `menu_venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`category_id` text NOT NULL,
	`data` text NOT NULL,
	`price` integer NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`position` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `menu_venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_venues` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_venues_slug_unique` ON `menu_venues` (`slug`);--> statement-breakpoint
CREATE INDEX menu_categories_venue ON menu_categories(venue_id,position);
--> statement-breakpoint
CREATE INDEX menu_items_category ON menu_items(category_id,position);
--> statement-breakpoint
CREATE TRIGGER menu_item_price_guard BEFORE INSERT ON menu_items WHEN typeof(NEW.price)!='integer' OR NEW.price<0 BEGIN SELECT RAISE(ABORT,'INVALID_PRICE'); END;
--> statement-breakpoint
CREATE TRIGGER menu_item_price_guard_update BEFORE UPDATE OF price ON menu_items WHEN typeof(NEW.price)!='integer' OR NEW.price<0 BEGIN SELECT RAISE(ABORT,'INVALID_PRICE'); END;
