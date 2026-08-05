CREATE TABLE `surf_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`observed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`trim` text NOT NULL,
	`quality` integer NOT NULL,
	`note` text,
	`created_by` text
);
