import {
  createPlatformSetupLog,
  deletePlatformSetupLog,
  getPlatformSetupLogs,
} from "@/db/platform-setup-logs";

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalBoolean(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "40");
  const logs = await getPlatformSetupLogs(limit);
  return Response.json({
    logs,
    rowCount: logs.length,
    fetchedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const loggedAt = Number(body.loggedAt);

    if (!Number.isFinite(loggedAt) || loggedAt <= 0) {
      return Response.json(
        { error: "Datum muss eingetragen werden" },
        { status: 400 },
      );
    }

    const createdBy = request.headers.get("oai-authenticated-user-email");
    const log = await createPlatformSetupLog({
      loggedAt,
      waveMaster: cleanText(body.waveMaster, 120) || null,
      chainLeftCm: optionalNumber(body.chainLeftCm),
      chainRightCm: optionalNumber(body.chainRightCm),
      rampPosition: cleanText(body.rampPosition, 120) || null,
      trimHeightCm: optionalNumber(body.trimHeightCm),
      tensionLeft: optionalBoolean(body.tensionLeft),
      tensionRight: optionalBoolean(body.tensionRight),
      waterLevelCm: optionalNumber(body.waterLevelCm),
      dischargeCms: optionalNumber(body.dischargeCms),
      note: cleanText(body.note, 600) || null,
      createdBy,
    });

    return Response.json({ log });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Setup-Wert konnte nicht gespeichert werden",
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

    const deleted = await deletePlatformSetupLog(id);
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
          error instanceof Error ? error.message : "Eintrag konnte nicht gelöscht werden",
      },
      { status: 500 },
    );
  }
}
