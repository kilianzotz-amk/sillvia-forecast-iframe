import { env } from "cloudflare:workers";
import {
  compactElectricityPrices,
  type ElectricityPricePoint,
} from "@/lib/electricity";

type ElectricityPriceRow = {
  starts_at: number;
  ends_at: number;
  market_price_eur_mwh: number | null;
  unit: "Eur/MWh";
  source: "aWATTar";
};

function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }

  return env.DB;
}

export async function storeElectricityPrices(points: ElectricityPricePoint[]) {
  const db = getD1();
  const collectedAt = Date.now();
  let writes = 0;
  const statements = points.map((point) =>
    db
      .prepare(
        `INSERT INTO electricity_prices (
          starts_at,
          ends_at,
          collected_at,
          market_price_eur_mwh,
          unit,
          source
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(starts_at) DO UPDATE SET
          ends_at = excluded.ends_at,
          collected_at = excluded.collected_at,
          market_price_eur_mwh = excluded.market_price_eur_mwh,
          unit = excluded.unit,
          source = excluded.source`,
      )
      .bind(
        point.t,
        point.end,
        collectedAt,
        point.marketPriceEurMwh,
        point.unit,
        point.source,
      ),
  );

  const chunkSize = 500;
  for (let index = 0; index < statements.length; index += chunkSize) {
    const results = await db.batch(statements.slice(index, index + chunkSize));
    writes += results.reduce(
      (sum, result) => sum + (result.meta.changes ?? 0),
      0,
    );
  }

  return { collectedAt, writes };
}

export async function getRecentElectricityPrices(hours = 72) {
  const db = getD1();
  const since = Date.now() - hours * 60 * 60 * 1000;
  const result = await db
    .prepare(
      `SELECT starts_at, ends_at, market_price_eur_mwh, unit, source
       FROM electricity_prices
       WHERE starts_at >= ?
       ORDER BY starts_at ASC`,
    )
    .bind(since)
    .all<ElectricityPriceRow>();

  return compactElectricityPrices(
    (result.results ?? []).map((row) => ({
      t: row.starts_at,
      end: row.ends_at,
      marketPriceEurMwh: row.market_price_eur_mwh,
      unit: row.unit,
      source: row.source,
    })),
  );
}
