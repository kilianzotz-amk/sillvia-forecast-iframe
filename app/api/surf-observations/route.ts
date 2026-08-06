import {
  createSurfObservation,
  deleteSurfObservation,
  getRecentSurfObservations,
  updateSurfObservation,
} from "@/db/surf-observations";

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 180) : fallback;
}

function parseRequiredTimestamp(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseObservationInput(body: Record<string, unknown>) {
  const quality = Number(body.quality);
  const trimCm = Number(body.trimCm);
  const observedAt = parseRequiredTimestamp(body.observedAt);

  if (observedAt === null) {
    return { error: "Zeitpunkt muss eingetragen werden" };
  }
  if (!Number.isFinite(trimCm) || trimCm < 0) {
    return { error: "Trim muss als cm-Wert eingetragen werden" };
  }
  if (!Number.isFinite(quality) || quality < 1 || quality > 5) {
    return { error: "Qualität muss zwischen 1 und 5 liegen" };
  }

  const roundedTrim = Math.round(trimCm * 10) / 10;
  const roundedQuality = Math.round(quality * 10) / 10;

  return {
    observedAt,
    trimCm: roundedTrim,
    trim: `${roundedTrim} cm`,
    quality: roundedQuality,
    note: cleanText(body.note) || null,
  };
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
    const parsed = parseObservationInput(body);

    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const createdBy = request.headers.get("oai-authenticated-user-email");
    const observation = await createSurfObservation({
      ...parsed,
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

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Ungültige ID" }, { status: 400 });
    }

    const parsed = parseObservationInput(body);

    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const observation = await updateSurfObservation({
      id,
      ...parsed,
    });

    return Response.json({ observation });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Eintrag konnte nicht aktualisiert werden",
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
