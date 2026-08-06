import {
  createSurfObservation,
  deleteSurfObservation,
  getRecentSurfObservations,
} from "@/db/surf-observations";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 180) : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Number(url.searchParams.get("hours") ?? "72");
  const observations = await getRecentSurfObservations(hours);
  return Response.json({
    observations,
    rowCount: observations.length,
    fetchedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const quality = Number(body.quality);
    const trimCm = Number(body.trimCm);
    const note = cleanText(body.note) || null;
    const observedAtValue = Number(body.observedAt);
    const observedAt =
      Number.isFinite(observedAtValue) && observedAtValue > 0
        ? observedAtValue
        : Date.now();

    if (!Number.isFinite(trimCm) || trimCm < 0) {
      return Response.json(
        { error: "Trim muss als cm-Wert eingetragen werden" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(quality) || quality < 1 || quality > 5) {
      return Response.json(
        { error: "Qualität muss zwischen 1 und 5 liegen" },
        { status: 400 },
      );
    }

    const createdBy = request.headers.get("oai-authenticated-user-email");
    const observation = await createSurfObservation({
      observedAt,
      trim: `${trimCm} cm`,
      trimCm,
      quality: Math.round(quality * 10) / 10,
      note,
      createdBy,
    });

    return Response.json({ observation });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Beobachtung konnte nicht gespeichert werden",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Ungültige ID" }, { status: 400 });
    }

    const deleted = await deleteSurfObservation(id);
    if (!deleted) {
      return Response.json(
        { error: "Eintrag wurde nicht gefunden" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Eintrag konnte nicht gelöscht werden",
      },
      { status: 500 },
    );
  }
}
