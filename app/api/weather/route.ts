import { getRecentWeatherHistory, storeWeatherPoints } from "@/db/weather-history";
import {
  compactWeatherHistory,
  emptyWeatherPayload,
  fetchWeatherCurrent,
  fetchWeatherHistorical,
  weatherStations,
  type WeatherPoint,
} from "@/lib/weather";

function databaseHasRequestedCoverage(history: WeatherPoint[], hours: number) {
  if (!history.length) return false;

  const now = Date.now();
  const requestedSince = now - hours * 60 * 60 * 1000;
  const times = history.map((point) => point.t);
  const oldest = Math.min(...times);
  const newest = Math.max(...times);
  const expectedPoints = hours * 6 * weatherStations.length;
  const hasEnoughPoints = history.length >= expectedPoints * 0.6;
  const startsNearRequestedWindow =
    oldest <= requestedSince + Math.min(2 * 60 * 60 * 1000, hours * 0.08 * 60 * 60 * 1000);
  const reachesCurrentWindow = newest >= now - 3 * 60 * 60 * 1000;

  return hasEnoughPoints && startsNearRequestedWindow && reachesCurrentWindow;
}

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
      if (databaseHasRequestedCoverage(databaseHistory, safeHours)) {
        return Response.json({
          ...emptyWeatherPayload(),
          history: compactWeatherHistory([...databaseHistory, ...livePoints]),
          historySource: "database",
        });
      }

      const historical = await fetchWeatherHistorical(safeHours);
      try {
        await storeWeatherPoints(historical);
      } catch {
        // Direct GeoSphere history is still useful even if D1 is unavailable.
      }

      return Response.json({
        ...emptyWeatherPayload(),
        history: compactWeatherHistory([
          ...databaseHistory,
          ...historical,
          ...livePoints,
        ]),
        historySource: databaseHistory.length ? "mixed" : "geosphere",
      });
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
