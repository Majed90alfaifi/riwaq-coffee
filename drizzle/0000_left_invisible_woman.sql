CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`customer_id` text,
	`token_hash` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`customer` text NOT NULL,
	`subtotal` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`provider_id` text,
	`tracking` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request_key_unique` ON `orders` (`request_key`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'blocked_config' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`weight` integer NOT NULL,
	`grind` integer NOT NULL,
	`price` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX orders_status_expiry ON orders(status,expires_at);
--> statement-breakpoint
CREATE INDEX order_lines_order ON order_lines(order_id);
--> statement-breakpoint
CREATE TRIGGER stock_nonnegative_insert BEFORE INSERT ON inventory WHEN NEW.stock<0 OR typeof(NEW.stock)!='integer' BEGIN SELECT RAISE(ABORT,'INVALID_STOCK'); END;
--> statement-breakpoint
CREATE TRIGGER stock_nonnegative_update BEFORE UPDATE ON inventory WHEN NEW.stock<0 OR typeof(NEW.stock)!='integer' BEGIN SELECT RAISE(ABORT,'INVALID_STOCK'); END;
--> statement-breakpoint
CREATE TRIGGER product_version_guard BEFORE UPDATE ON products WHEN NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'STALE_VERSION'); END;
--> statement-breakpoint
CREATE TRIGGER line_guard BEFORE INSERT ON order_lines BEGIN
 SELECT CASE WHEN typeof(NEW.qty)!='integer' OR NEW.qty<1 OR NEW.qty>20 THEN RAISE(ABORT,'INVALID_QUANTITY') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM variants v JOIN products p ON p.id=v.product_id JOIN inventory i ON i.id=v.inventory_id WHERE v.id=NEW.variant_id AND v.inventory_id=NEW.inventory_id AND v.price=NEW.price AND v.active=1 AND p.active=1 AND i.stock>=NEW.qty) THEN RAISE(ABORT,'INSUFFICIENT_STOCK') END;
END;
--> statement-breakpoint
CREATE TRIGGER line_reserve AFTER INSERT ON order_lines BEGIN UPDATE inventory SET stock=stock-NEW.qty WHERE id=NEW.inventory_id; END;
--> statement-breakpoint
CREATE TRIGGER release_reservation AFTER UPDATE OF status ON orders WHEN OLD.status='pending' AND NEW.status IN ('cancelled','payment_failed','expired') BEGIN
 UPDATE inventory SET stock=stock+COALESCE((SELECT SUM(qty) FROM order_lines WHERE order_id=NEW.id AND inventory_id=inventory.id),0) WHERE id IN (SELECT inventory_id FROM order_lines WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER event_guard BEFORE INSERT ON payment_events BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM orders WHERE id=NEW.order_id AND mode='sandbox' AND ((NEW.kind IN ('paid','failed','cancelled') AND status='pending') OR (NEW.kind='refunded' AND status='paid'))) THEN RAISE(ABORT,'STALE_EVENT') END;
END;
