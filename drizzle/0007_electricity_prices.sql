CREATE TABLE IF NOT EXISTS `electricity_prices` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `starts_at` integer NOT NULL,
  `ends_at` integer NOT NULL,
  `collected_at` integer NOT NULL,
  `market_price_eur_mwh` real,
  `unit` text NOT NULL,
  `source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `electricity_prices_starts_at_idx`
ON `electricity_prices` (`starts_at`);
