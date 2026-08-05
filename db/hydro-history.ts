import { env } from "cloudflare:workers";
import {
  compactHistory,
  type HistoryPoint,
  type HydroPayload,
  stationOrder,
  timeFromStations,
} from "@/lib/hydro";

type MeasurementRow = {
  station_id: string;
  measured_at: number;
  water_value: number | null;
  discharge_value: number | null;
};

export type HydroArchiveRow = {
  station_id: string;
  short_name: string;
  measured_at: number;
  collected_at: number;
  water_value: number | null;
  water_unit: string | null;
  water_classification: string | null;
  water_tendency: number | null;
  discharge_value: number | null;
  discharge_unit: string | null;
};

function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }

  return env.DB;
}

export async function storeHydroPayload(payload: HydroPayload) {
  const db = getD1();
  const collectedAt = Date.now();
  let writes = 0;

  for (const station of payload.stations) {
    const measuredAt =
      station.discharge.dt ?? station.water.dt ?? timeFromStations(payload.stations);

    const result = await db
      .prepare(
        `INSERT INTO hydro_measurements (
          station_id,
          short_name,
          measured_at,
          collected_at,
          water_value,
          water_unit,
          water_classification,
          water_tendency,
          discharge_value,
          discharge_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(station_id, measured_at) DO UPDATE SET
          collected_at = excluded.collected_at,
          water_value = excluded.water_value,
          water_unit = excluded.water_unit,
          water_classification = excluded.water_classification,
          water_tendency = excluded.water_tendency,
          discharge_value = excluded.discharge_value,
          discharge_unit = excluded.discharge_unit`,
      )
      .bind(
        station.id,
        station.shortName,
        measuredAt,
        collectedAt,
        station.water.value,
        station.water.unit,
        station.water.classification ?? null,
        station.water.tendency ?? null,
        station.discharge.value,
        station.discharge.unit,
      )
      .run();

    writes += result.meta.changes ?? 0;
  }

  return { collectedAt, writes };
}

export async function getRecentHydroHistory(hours = 72) {
  const db = getD1();
  const since = Date.now() - hours * 60 * 60 * 1000;
  const result = await db
    .prepare(
      `SELECT station_id, measured_at, water_value, discharge_value
       FROM hydro_measurements
       WHERE measured_at >= ?
       ORDER BY measured_at ASC`,
    )
    .bind(since)
    .all<MeasurementRow>();

  const pointsByTime = new Map<number, HistoryPoint>();

  for (const row of result.results ?? []) {
    if (!stationOrder.includes(row.station_id)) continue;
    const t = Math.round(row.measured_at / (15 * 60 * 1000)) * (15 * 60 * 1000);
    const point =
      pointsByTime.get(t) ??
      ({
        t,
        kroessbach: null,
        puig: null,
        reichenau: null,
        kroessbachLevel: null,
        puigLevel: null,
        reichenauLevel: null,
      } satisfies HistoryPoint);

    if (row.station_id === "202283") {
      point.kroessbach = row.discharge_value;
      point.kroessbachLevel = row.water_value;
    }
    if (row.station_id === "201574") {
      point.puig = row.discharge_value;
      point.puigLevel = row.water_value;
    }
    if (row.station_id === "201624") {
      point.reichenau = row.discharge_value;
      point.reichenauLevel = row.water_value;
    }

    pointsByTime.set(t, point);
  }

  return compactHistory([...pointsByTime.values()]);
}

export async function getHydroArchiveRows(days = 7) {
  const db = getD1();
  const safeDays = Math.min(365, Math.max(1, Math.round(days)));
  const since = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const result = await db
    .prepare(
      `SELECT
        station_id,
        short_name,
        measured_at,
        collected_at,
        water_value,
        water_unit,
        water_classification,
        water_tendency,
        discharge_value,
        discharge_unit
       FROM hydro_measurements
       WHERE measured_at >= ?
       ORDER BY measured_at ASC, station_id ASC`,
    )
    .bind(since)
    .all<HydroArchiveRow>();

  return result.results ?? [];
}
