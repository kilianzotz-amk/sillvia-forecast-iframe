import { env } from "cloudflare:workers";
import {
  compactWeatherHistory,
  type WeatherPoint,
  weatherStations,
} from "@/lib/weather";

type WeatherMeasurementRow = {
  station_id: string;
  measured_at: number;
  rain_mm: number | null;
  source: "GeoSphere Klima" | "GeoSphere TAWES";
};

function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`.",
    );
  }

  return env.DB;
}

export async function storeWeatherPoints(points: WeatherPoint[]) {
  const db = getD1();
  const collectedAt = Date.now();
  let writes = 0;

  for (const point of points) {
    const station = weatherStations.find((entry) => entry.id === point.stationId);
    if (!station) continue;

    const result = await db
      .prepare(
        `INSERT INTO weather_measurements (
          station_id,
          station_name,
          source_station_id,
          source,
          measured_at,
          collected_at,
          rain_mm,
          unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(station_id, measured_at) DO UPDATE SET
          station_name = excluded.station_name,
          source_station_id = excluded.source_station_id,
          source = excluded.source,
          collected_at = excluded.collected_at,
          rain_mm = excluded.rain_mm,
          unit = excluded.unit`,
      )
      .bind(
        station.id,
        station.name,
        point.source === "GeoSphere TAWES" ? station.tawesId : station.climateId,
        point.source,
        point.t,
        collectedAt,
        point.rainMm,
        "mm",
      )
      .run();

    writes += result.meta.changes ?? 0;
  }

  return { collectedAt, writes };
}

export async function getRecentWeatherHistory(hours = 72) {
  const db = getD1();
  const since = Date.now() - hours * 60 * 60 * 1000;
  const result = await db
    .prepare(
      `SELECT station_id, measured_at, rain_mm, source
       FROM weather_measurements
       WHERE measured_at >= ?
       ORDER BY measured_at ASC, station_id ASC`,
    )
    .bind(since)
    .all<WeatherMeasurementRow>();

  return compactWeatherHistory(
    (result.results ?? []).map((row) => ({
      t: row.measured_at,
      stationId: row.station_id,
      rainMm: row.rain_mm,
      source: row.source,
    })),
  );
}
