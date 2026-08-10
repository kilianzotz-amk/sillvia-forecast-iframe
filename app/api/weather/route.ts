import { getRecentWeatherHistory, storeWeatherPoints } from "@/db/weather-history";
import {
  compactWeatherHistory,
  emptyWeatherPayload,
  fetchWeatherCurrent,
  fetchWeatherHistorical,
} from "@/lib/weather";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "72");
  const safeHours = Math.min(365 * 24, Math.max(1, Math.round(hours)));

  try {
    let livePoints = [];

    try {
      livePoints = await fetchWeatherCurrent();
      await storeWeatherPoints(livePoints);
    } catch {
      livePoints = [];
    }

    try {
      const databaseHistory = await getRecentWeatherHistory(safeHours);
      if (databaseHistory.length) {
        return Response.json({
          ...emptyWeatherPayload(),
          history: compactWeatherHistory([...databaseHistory, ...livePoints]),
          historySource: "database",
        });
      }
    } catch {
      // The dashboard can fall back to direct GeoSphere history.
    }

    const historical = await fetchWeatherHistorical(safeHours);
    try {
      await storeWeatherPoints(historical);
    } catch {
      // Direct GeoSphere history is still useful even if D1 is unavailable.
    }

    return Response.json({
      ...emptyWeatherPayload(),
      history: compactWeatherHistory([...historical, ...livePoints]),
      historySource: "geosphere",
    });
  } catch (error) {
    return Response.json(
      {
        ...emptyWeatherPayload(),
        error:
          error instanceof Error
            ? error.message
            : "GeoSphere Wetterdaten konnten nicht geladen werden",
      },
      { status: 502 },
    );
  }
}
