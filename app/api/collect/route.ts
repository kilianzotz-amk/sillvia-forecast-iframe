import { getRecentHydroHistory, storeHydroPayload } from "@/db/hydro-history";
import { fetchHydroPayload } from "@/lib/hydro";

async function collect() {
  try {
    const payload = await fetchHydroPayload();

    try {
      const stored = await storeHydroPayload(payload);
      const history = await getRecentHydroHistory();

      return Response.json({
        ...payload,
        history,
        historySource: "database",
        collector: {
          ok: true,
          collectedAt: new Date(stored.collectedAt).toISOString(),
          writes: stored.writes,
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
