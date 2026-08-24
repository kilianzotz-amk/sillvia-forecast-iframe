import { storeElectricityPrices } from "@/db/electricity-prices";
import {
  getHydroRatingSamples,
  storeHydroBackfillPoints,
} from "@/db/hydro-history";
import { storeWeatherPoints } from "@/db/weather-history";
import { fetchElectricityHistorical } from "@/lib/electricity";
import {
  fetchHydroWaterBackfill,
  type HydroWaterBackfillPoint,
} from "@/lib/hydro";
import { fetchWeatherHistorical } from "@/lib/weather";

type RatingSample = {
  water: number;
  discharge: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return null;
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildRatingSamples(
  rows: Awaited<ReturnType<typeof getHydroRatingSamples>>,
) {
  const grouped = new Map<string, Map<number, number[]>>();

  for (const row of rows) {
    const station = grouped.get(row.station_id) ?? new Map<number, number[]>();
    const water = Math.round(row.water_value * 10) / 10;
    const values = station.get(water) ?? [];
    values.push(row.discharge_value);
    station.set(water, values);
    grouped.set(row.station_id, station);
  }

  const samples = new Map<string, RatingSample[]>();
  for (const [stationId, byWater] of grouped) {
    const stationSamples = [...byWater.entries()]
      .map(([water, discharges]) => {
        const discharge = median(discharges);
        return discharge === null ? null : { water, discharge };
      })
      .filter((sample): sample is RatingSample => sample !== null)
      .sort((a, b) => a.water - b.water);

    samples.set(stationId, stationSamples);
  }

  return samples;
}

function estimateDischarge(
  point: HydroWaterBackfillPoint,
  samplesByStation: Map<string, RatingSample[]>,
) {
  const samples = samplesByStation.get(point.stationId) ?? [];
  if (samples.length === 0) return null;
  if (samples.length === 1) return samples[0].discharge;

  let previous = samples[0];
  for (const current of samples) {
    if (Math.abs(current.water - point.waterValue) < 0.05) {
      return current.discharge;
    }
    if (current.water >= point.waterValue) {
      const span = current.water - previous.water;
      if (span <= 0) return current.discharge;
      const ratio = (point.waterValue - previous.water) / span;
      return previous.discharge + ratio * (current.discharge - previous.discharge);
    }
    previous = current;
  }

  return previous.discharge;
}

async function backfill(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "24");
  const safeHours = Math.min(24, Math.max(1, Math.round(hours)));

  try {
    const waterPoints = await fetchHydroWaterBackfill(safeHours);
    const samplesByStation = buildRatingSamples(await getHydroRatingSamples());
    const hydroPoints = waterPoints.map((point) => ({
      ...point,
      dischargeValue: estimateDischarge(point, samplesByStation),
      dischargeUnit: "m³/s",
    }));
    const hydroStored = await storeHydroBackfillPoints(hydroPoints);

    let weather:
      | { ok: true; points: number; writes: number }
      | { ok: false; error: string };
    let electricity:
      | { ok: true; points: number; writes: number }
      | { ok: false; error: string };

    try {
      const weatherPoints = await fetchWeatherHistorical(safeHours);
      const weatherStored = await storeWeatherPoints(weatherPoints);
      weather = {
        ok: true,
        points: weatherPoints.length,
        writes: weatherStored.writes,
      };
    } catch (error) {
      weather = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Regen-Backfill fehlgeschlagen",
      };
    }
    try {
      const electricityPoints = await fetchElectricityHistorical(
        Math.max(safeHours, 31 * 24),
      );
      const electricityStored = await storeElectricityPrices(electricityPoints);
      electricity = {
        ok: true,
        points: electricityPoints.length,
        writes: electricityStored.writes,
      };
    } catch (error) {
      electricity = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Strompreis-Backfill fehlgeschlagen",
      };
    }

    return Response.json({
      ok: true,
      hours: safeHours,
      hydro: {
        points: hydroPoints.length,
        writes: hydroStored.writes,
        estimatedDischargePoints: hydroPoints.filter(
          (point) => point.dischargeValue !== null,
        ).length,
      },
      weather,
      electricity,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Backfill fehlgeschlagen",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return backfill(request);
}

export async function POST(request: Request) {
  return backfill(request);
}
