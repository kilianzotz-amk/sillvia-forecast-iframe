import { getRecentHydroHistory, storeHydroPayload } from "@/db/hydro-history";
import { fetchHydroPayload } from "@/lib/hydro";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "72");
  const safeHours = Math.min(365 * 24, Math.max(1, Math.round(hours)));

  try {
    const payload = await fetchHydroPayload();

    try {
      await storeHydroPayload(payload);
    } catch {
      // The live dashboard should keep working if persistence is temporarily unavailable.
    }

    try {
      const history = await getRecentHydroHistory(safeHours);
      return Response.json({
        ...payload,
        history,
        historySource: "database",
      });
    } catch {
      return Response.json(payload);
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Hydro Tirol konnte nicht geladen werden",
      },
      { status: 502 },
    );
  }
}
