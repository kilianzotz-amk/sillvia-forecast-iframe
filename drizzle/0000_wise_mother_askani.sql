CREATE TABLE `hydro_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` text NOT NULL,
	`short_name` text NOT NULL,
	`measured_at` integer NOT NULL,
	`collected_at` integer NOT NULL,
	`water_value` real,
	`water_unit` text,
	`water_classification` text,
	`water_tendency` integer,
	`discharge_value` real,
	`discharge_unit` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hydro_measurements_station_measured_idx` ON `hydro_measurements` (`station_id`,`measured_at`);