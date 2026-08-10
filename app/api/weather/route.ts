import { getRecentWeatherHistory, storeWeatherPoints } from "@/db/weather-history";
import {
  compactWeatherHistory,
  emptyWeatherPayload,
  fetchWeatherCurrent,
  fetchWeatherForecast,
  fetchWeatherHistorical,
  weatherStations,
  type WeatherPoint,
} from "@/lib/weather";

function databaseHasRequestedCoverage(history: WeatherPoint[], hours: number) {
  if (!history.length) return false;

  const now = Date.now();
  const requestedSince = now - hours * 60 * 60 * 1000;
  const expectedPointsPerStation = hours * 6;
  const startTolerance = Math.min(
    2 * 60 * 60 * 1000,
    hours * 0.08 * 60 * 60 * 1000,
  );

  return weatherStations.every((station) => {
    const stationHistory = history.filter((point) => point.stationId === station.id);
    if (!stationHistory.length) return false;

    const times = stationHistory.map((point) => point.t);
    const oldest = Math.min(...times);
    const newest = Math.max(...times);
    const hasEnoughPoints = stationHistory.length >= expectedPointsPerStation * 0.55;
    const startsNearRequestedWindow = oldest <= requestedSince + startTolerance;
    const reachesCurrentWindow = newest >= now - 3 * 60 * 60 * 1000;

    return hasEnoughPoints && startsNearRequestedWindow && reachesCurrentWindow;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "72");
  const safeHours = Math.min(31 * 24, Math.max(1, Math.round(hours)));

  try {
    let livePoints = [];
    let forecastPoints = [];

    try {
      forecastPoints = await fetchWeatherForecast();
    } catch {
      forecastPoints = [];
    }

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
          forecast: compactWeatherHistory(forecastPoints),
          historySource: "database",
        });
      }

      const historical = await fetchWeatherHistorical(safeHours);
      if (safeHours <= 24) {
        try {
          await storeWeatherPoints(historical);
        } catch {
          // Direct GeoSphere history is still useful even if D1 is unavailable.
        }
      }

      return Response.json({
        ...emptyWeatherPayload(),
        history: compactWeatherHistory([
          ...databaseHistory,
          ...historical,
          ...livePoints,
        ]),
        forecast: compactWeatherHistory(forecastPoints),
        historySource: databaseHistory.length ? "mixed" : "geosphere",
      });
    } catch {
      // The dashboard can fall back to direct GeoSphere history.
    }

    const historical = await fetchWeatherHistorical(safeHours);
    if (safeHours <= 24) {
      try {
        await storeWeatherPoints(historical);
      } catch {
        // Direct GeoSphere history is still useful even if D1 is unavailable.
      }
    }

    return Response.json({
      ...emptyWeatherPayload(),
      history: compactWeatherHistory([...historical, ...livePoints]),
      forecast: compactWeatherHistory(forecastPoints),
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
