CREATE TABLE `weather_measurements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `station_id` text NOT NULL,
  `station_name` text NOT NULL,
  `source_station_id` text NOT NULL,
  `source` text NOT NULL,
  `measured_at` integer NOT NULL,
  `collected_at` integer NOT NULL,
  `rain_mm` real,
  `unit` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weather_measurements_station_measured_idx` ON `weather_measurements` (`station_id`, `measured_at`);
--> statement-breakpoint
CREATE INDEX `idx_weather_measurements_measured_at` ON `weather_measurements` (`measured_at`);
