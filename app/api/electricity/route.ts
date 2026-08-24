import {
  getRecentElectricityPrices,
  storeElectricityPrices,
} from "@/db/electricity-prices";
import {
  compactElectricityPrices,
  emptyElectricityPayload,
  fetchElectricityCurrent,
  fetchElectricityHistorical,
} from "@/lib/electricity";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "72");
  const shouldStore = url.searchParams.get("store") === "1";
  const safeHours = Math.min(365 * 24, Math.max(1, Math.round(hours)));
  const now = Date.now();

  try {
    let livePoints = [];
    try {
      livePoints = await fetchElectricityCurrent();
      await storeElectricityPrices(livePoints);
    } catch {
      livePoints = [];
    }

    try {
      const databaseHistory = await getRecentElectricityPrices(safeHours);
      const databaseCoversWindow =
        databaseHistory.length > 0 &&
        databaseHistory[0].t <= now - safeHours * 60 * 60 * 1000 + 2 * 60 * 60 * 1000;

      if (databaseCoversWindow && !shouldStore) {
        return Response.json({
          ...emptyElectricityPayload(),
          history: compactElectricityPrices(databaseHistory.filter((point) => point.t <= now)),
          forecast: compactElectricityPrices(
            [...databaseHistory, ...livePoints].filter((point) => point.t > now),
          ),
          historySource: "database",
        });
      }

      const marketData = await fetchElectricityHistorical(safeHours);
      if (shouldStore || safeHours <= 31 * 24) {
        try {
          await storeElectricityPrices(marketData);
        } catch {
          // Direct aWATTar data is still useful even if D1 is unavailable.
        }
      }

      const merged = compactElectricityPrices([
        ...databaseHistory,
        ...marketData,
        ...livePoints,
      ]);

      return Response.json({
        ...emptyElectricityPayload(),
        history: compactElectricityPrices(merged.filter((point) => point.t <= now)),
        forecast: compactElectricityPrices(merged.filter((point) => point.t > now)),
        historySource: databaseHistory.length ? "mixed" : "awattar",
      });
    } catch {
      const marketData = await fetchElectricityHistorical(safeHours);
      return Response.json({
        ...emptyElectricityPayload(),
        history: compactElectricityPrices(marketData.filter((point) => point.t <= now)),
        forecast: compactElectricityPrices(marketData.filter((point) => point.t > now)),
        historySource: "awattar",
      });
    }
  } catch (error) {
    return Response.json(
      {
        ...emptyElectricityPayload(),
        error:
          error instanceof Error
            ? error.message
            : "Strompreise konnten nicht geladen werden",
      },
      { status: 502 },
    );
  }
}
