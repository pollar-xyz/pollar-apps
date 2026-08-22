ALTER TABLE `orders` ADD `number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `orders` SET `number` = (
  SELECT COUNT(*) FROM `orders` o2
  WHERE o2.`restaurant_id` = `orders`.`restaurant_id`
    AND (o2.`created_at` < `orders`.`created_at`
      OR (o2.`created_at` = `orders`.`created_at` AND o2.`rowid` <= `orders`.`rowid`))
);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_idx` ON `orders` (`restaurant_id`,`number`);
