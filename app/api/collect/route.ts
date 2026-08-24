import { storeElectricityPrices } from "@/db/electricity-prices";
import { storeHydroPayload } from "@/db/hydro-history";
import { storeWeatherPoints } from "@/db/weather-history";
import { fetchElectricityCurrent } from "@/lib/electricity";
import { fetchHydroPayload } from "@/lib/hydro";
import { fetchWeatherCurrent } from "@/lib/weather";

async function collect() {
  try {
    const payload = await fetchHydroPayload();
    let weatherCollector:
      | {
          ok: boolean;
          writes?: number;
          error?: string;
        }
      | undefined;
    let electricityCollector:
      | {
          ok: boolean;
          writes?: number;
          error?: string;
        }
      | undefined;

    try {
      const stored = await storeHydroPayload(payload);
      try {
        const weatherPoints = await fetchWeatherCurrent();
        const weatherStored = await storeWeatherPoints(weatherPoints);
        weatherCollector = {
          ok: true,
          writes: weatherStored.writes,
        };
      } catch (error) {
        weatherCollector = {
          ok: false,
          error:
            error instanceof Error ? error.message : "Regen speichern fehlgeschlagen",
        };
      }
      try {
        const electricityPrices = await fetchElectricityCurrent();
        const electricityStored = await storeElectricityPrices(electricityPrices);
        electricityCollector = {
          ok: true,
          writes: electricityStored.writes,
        };
      } catch (error) {
        electricityCollector = {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Strompreis speichern fehlgeschlagen",
        };
      }

      return Response.json({
        ok: true,
        collectedAt: new Date(stored.collectedAt).toISOString(),
        source: payload.source,
        hydroWrites: stored.writes,
        weather: weatherCollector,
        electricity: electricityCollector,
        stations: payload.stations.map((station) => ({
          id: station.id,
          shortName: station.shortName,
          measuredAt: new Date(
            station.discharge.dt ?? station.water.dt ?? stored.collectedAt,
          ).toISOString(),
          waterCm: station.water.value,
          dischargeCms: station.discharge.value,
        })),
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error:
            error instanceof Error ? error.message : "Speichern fehlgeschlagen",
          source: payload.source,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    return Response.json(
      {
        collector: {
          ok: false,
          error: error instanceof Error ? error.message : "Collector fehlgeschlagen",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return collect();
}

export async function POST() {
  return collect();
}
