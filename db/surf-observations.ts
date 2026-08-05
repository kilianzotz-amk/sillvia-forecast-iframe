import { env } from "cloudflare:workers";

export type SurfObservation = {
  id: number;
  observedAt: number;
  createdAt: number;
  trim: string;
  trimCm: number | null;
  quality: number;
  contextMeasuredAt: number | null;
  kroessbachDischarge: number | null;
  puigDischarge: number | null;
  reichenauDischarge: number | null;
  kroessbachLevel: number | null;
  puigLevel: number | null;
  reichenauLevel: number | null;
  note: string | null;
  createdBy: string | null;
};

type SurfObservationRow = {
  id: number;
  observed_at: number;
  created_at: number;
  trim: string;
  trim_cm: number | null;
  quality: number;
  context_measured_at: number | null;
  kroessbach_discharge: number | null;
  puig_discharge: number | null;
  reichenau_discharge: number | null;
  kroessbach_level: number | null;
  puig_level: number | null;
  reichenau_level: number | null;
  note: string | null;
  created_by: string | null;
};

type CreateSurfObservation = {
  observedAt: number;
  trim: string;
  trimCm: number;
  quality: number;
  note?: string | null;
  createdBy?: string | null;
};

type NearestMeasurementRow = {
  measured_at: number;
  water_value: number | null;
  discharge_value: number | null;
};

function getD1() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }

  return env.DB;
}

function rowToObservation(row: SurfObservationRow): SurfObservation {
  return {
    id: row.id,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    trim: row.trim,
    trimCm: row.trim_cm,
    quality: row.quality,
    contextMeasuredAt: row.context_measured_at,
    kroessbachDischarge: row.kroessbach_discharge,
    puigDischarge: row.puig_discharge,
    reichenauDischarge: row.reichenau_discharge,
    kroessbachLevel: row.kroessbach_level,
    puigLevel: row.puig_level,
    reichenauLevel: row.reichenau_level,
    note: row.note,
    createdBy: row.created_by,
  };
}

async function getNearestMeasurement(
  db: ReturnType<typeof getD1>,
  stationId: string,
  observedAt: number,
) {
  return db
    .prepare(
      `SELECT measured_at, water_value, discharge_value
       FROM hydro_measurements
       WHERE station_id = ?
       ORDER BY ABS(measured_at - ?) ASC
       LIMIT 1`,
    )
    .bind(stationId, observedAt)
    .first<NearestMeasurementRow>();
}

async function getHydroContext(db: ReturnType<typeof getD1>, observedAt: number) {
  const [kroessbach, puig, reichenau] = await Promise.all([
    getNearestMeasurement(db, "202283", observedAt),
    getNearestMeasurement(db, "201574", observedAt),
    getNearestMeasurement(db, "201624", observedAt),
  ]);
  const measuredTimes = [kroessbach, puig, reichenau]
    .map((row) => row?.measured_at)
    .filter((value): value is number => typeof value === "number");

  return {
    contextMeasuredAt: measuredTimes.length ? Math.max(...measuredTimes) : null,
    kroessbachDischarge: kroessbach?.discharge_value ?? null,
    puigDischarge: puig?.discharge_value ?? null,
    reichenauDischarge: reichenau?.discharge_value ?? null,
    kroessbachLevel: kroessbach?.water_value ?? null,
    puigLevel: puig?.water_value ?? null,
    reichenauLevel: reichenau?.water_value ?? null,
  };
}

export async function createSurfObservation(input: CreateSurfObservation) {
  const db = getD1();
  const createdAt = Date.now();
  const context = await getHydroContext(db, input.observedAt);
  const result = await db
    .prepare(
      `INSERT INTO surf_observations (
        observed_at,
        created_at,
        trim,
        trim_cm,
        quality,
        context_measured_at,
        kroessbach_discharge,
        puig_discharge,
        reichenau_discharge,
        kroessbach_level,
        puig_level,
        reichenau_level,
        note,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING
        id,
        observed_at,
        created_at,
        trim,
        trim_cm,
        quality,
        context_measured_at,
        kroessbach_discharge,
        puig_discharge,
        reichenau_discharge,
        kroessbach_level,
        puig_level,
        reichenau_level,
        note,
        created_by`,
    )
    .bind(
      input.observedAt,
      createdAt,
      input.trim,
      input.trimCm,
      input.quality,
      context.contextMeasuredAt,
      context.kroessbachDischarge,
      context.puigDischarge,
      context.reichenauDischarge,
      context.kroessbachLevel,
      context.puigLevel,
      context.reichenauLevel,
      input.note ?? null,
      input.createdBy ?? null,
    )
    .first<SurfObservationRow>();

  if (!result) throw new Error("Beobachtung konnte nicht gespeichert werden");
  return rowToObservation(result);
}

export async function getRecentSurfObservations(hours = 72) {
  const db = getD1();
  const safeHours = Math.min(24 * 30, Math.max(1, Math.round(hours)));
  const since = Date.now() - safeHours * 60 * 60 * 1000;
  const result = await db
    .prepare(
      `SELECT
        id,
        observed_at,
        created_at,
        trim,
        trim_cm,
        quality,
        context_measured_at,
        kroessbach_discharge,
        puig_discharge,
        reichenau_discharge,
        kroessbach_level,
        puig_level,
        reichenau_level,
        note,
        created_by
       FROM surf_observations
       WHERE observed_at >= ?
       ORDER BY observed_at DESC, id DESC`,
    )
    .bind(since)
    .all<SurfObservationRow>();

  return (result.results ?? []).map(rowToObservation);
}

export async function deleteSurfObservation(id: number) {
  const db = getD1();
  const result = await db
    .prepare("DELETE FROM surf_observations WHERE id = ?")
    .bind(id)
    .run();

  return result.meta.changes ?? 0;
}
