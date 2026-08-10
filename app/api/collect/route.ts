import { getRecentHydroHistory, storeHydroPayload } from "@/db/hydro-history";
import { getRecentWeatherHistory, storeWeatherPoints } from "@/db/weather-history";
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

    try {
      const stored = await storeHydroPayload(payload);
      const history = await getRecentHydroHistory();
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
      let weatherHistory = [];
      try {
        weatherHistory = await getRecentWeatherHistory();
      } catch {
        weatherHistory = [];
      }

      return Response.json({
        ...payload,
        history,
        weather: {
          history: weatherHistory,
          historySource: "database",
        },
        historySource: "database",
        collector: {
          ok: true,
          collectedAt: new Date(stored.collectedAt).toISOString(),
          writes: stored.writes,
          weather: weatherCollector,
        },
      });
    } catch (error) {
      return Response.json({
        ...payload,
        collector: {
          ok: false,
          error:
            error instanceof Error ? error.message : "Speichern fehlgeschlagen",
        },
      });
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
