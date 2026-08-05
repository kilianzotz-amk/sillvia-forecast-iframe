import { getRecentHydroHistory, storeHydroPayload } from "@/db/hydro-history";
import { fetchHydroPayload } from "@/lib/hydro";

export async function GET() {
  try {
    const payload = await fetchHydroPayload();

    try {
      await storeHydroPayload(payload);
    } catch {
      // The live dashboard should keep working if persistence is temporarily unavailable.
    }

    try {
      const history = await getRecentHydroHistory();
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
