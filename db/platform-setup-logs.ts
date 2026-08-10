import { env } from "cloudflare:workers";

export type PlatformSetupLog = {
  id: number;
  loggedAt: number;
  createdAt: number;
  waveMaster: string | null;
  chainLeftCm: number | null;
  chainRightCm: number | null;
  rampPosition: string | null;
  trimHeightCm: number | null;
  tensionLeft: boolean | null;
  tensionRight: boolean | null;
  waterLevelCm: number | null;
  dischargeCms: number | null;
  note: string | null;
  createdBy: string | null;
};

type PlatformSetupLogRow = {
  id: number;
  logged_at: number;
  created_at: number;
  wave_master: string | null;
  chain_left_cm: number | null;
  chain_right_cm: number | null;
  ramp_position: string | null;
  trim_height_cm: number | null;
  tension_left: number | null;
  tension_right: number | null;
  water_level_cm: number | null;
  discharge_cms: number | null;
  note: string | null;
  created_by: string | null;
};

type CreatePlatformSetupLog = {
  loggedAt: number;
  waveMaster?: string | null;
  chainLeftCm?: number | null;
  chainRightCm?: number | null;
  rampPosition?: string | null;
  trimHeightCm?: number | null;
  tensionLeft?: boolean | null;
  tensionRight?: boolean | null;
  waterLevelCm?: number | null;
  dischargeCms?: number | null;
  note?: string | null;
  createdBy?: string | null;
};

type UpdatePlatformSetupLog = Omit<CreatePlatformSetupLog, "createdBy"> & {
  id: number;
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

function rowToLog(row: PlatformSetupLogRow): PlatformSetupLog {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    createdAt: row.created_at,
    waveMaster: row.wave_master,
    chainLeftCm: row.chain_left_cm,
    chainRightCm: row.chain_right_cm,
    rampPosition: row.ramp_position,
    trimHeightCm: row.trim_height_cm,
    tensionLeft: row.tension_left === null ? null : Boolean(row.tension_left),
    tensionRight: row.tension_right === null ? null : Boolean(row.tension_right),
    waterLevelCm: row.water_level_cm,
    dischargeCms: row.discharge_cms,
    note: row.note,
    createdBy: row.created_by,
  };
}

async function getNearestReichenauMeasurement(
  db: ReturnType<typeof getD1>,
  loggedAt: number,
) {
  return db
    .prepare(
      `SELECT measured_at, water_value, discharge_value
       FROM hydro_measurements
       WHERE station_id = ?
       ORDER BY ABS(measured_at - ?) ASC
       LIMIT 1`,
    )
    .bind("201624", loggedAt)
    .first<NearestMeasurementRow>();
}

async function withReichenauContext(
  db: ReturnType<typeof getD1>,
  input: CreatePlatformSetupLog | UpdatePlatformSetupLog,
) {
  const reichenau = await getNearestReichenauMeasurement(db, input.loggedAt);

  return {
    waterLevelCm: reichenau?.water_value ?? input.waterLevelCm ?? null,
    dischargeCms: reichenau?.discharge_value ?? input.dischargeCms ?? null,
  };
}

export async function createPlatformSetupLog(input: CreatePlatformSetupLog) {
  const db = getD1();
  const context = await withReichenauContext(db, input);
  const result = await db
    .prepare(
      `INSERT INTO platform_setup_logs (
        logged_at,
        created_at,
        wave_master,
        chain_left_cm,
        chain_right_cm,
        ramp_position,
        trim_height_cm,
        tension_left,
        tension_right,
        water_level_cm,
        discharge_cms,
        note,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING
        id,
        logged_at,
        created_at,
        wave_master,
        chain_left_cm,
        chain_right_cm,
        ramp_position,
        trim_height_cm,
        tension_left,
        tension_right,
        water_level_cm,
        discharge_cms,
        note,
        created_by`,
    )
    .bind(
      input.loggedAt,
      Date.now(),
      input.waveMaster ?? null,
      input.chainLeftCm ?? null,
      input.chainRightCm ?? null,
      input.rampPosition ?? null,
      input.trimHeightCm ?? null,
      input.tensionLeft === null || input.tensionLeft === undefined
        ? null
        : Number(input.tensionLeft),
      input.tensionRight === null || input.tensionRight === undefined
        ? null
        : Number(input.tensionRight),
      context.waterLevelCm,
      context.dischargeCms,
      input.note ?? null,
      input.createdBy ?? null,
    )
    .first<PlatformSetupLogRow>();

  if (!result) throw new Error("Setup-Wert konnte nicht gespeichert werden");
  return rowToLog(result);
}

export async function updatePlatformSetupLog(input: UpdatePlatformSetupLog) {
  const db = getD1();
  const context = await withReichenauContext(db, input);
  const result = await db
    .prepare(
      `UPDATE platform_setup_logs
       SET
        logged_at = ?,
        wave_master = ?,
        chain_left_cm = ?,
        chain_right_cm = ?,
        ramp_position = ?,
        trim_height_cm = ?,
        tension_left = ?,
        tension_right = ?,
        water_level_cm = ?,
        discharge_cms = ?,
        note = ?
       WHERE id = ?
       RETURNING
        id,
        logged_at,
        created_at,
        wave_master,
        chain_left_cm,
        chain_right_cm,
        ramp_position,
        trim_height_cm,
        tension_left,
        tension_right,
        water_level_cm,
        discharge_cms,
        note,
        created_by`,
    )
    .bind(
      input.loggedAt,
      input.waveMaster ?? null,
      input.chainLeftCm ?? null,
      input.chainRightCm ?? null,
      input.rampPosition ?? null,
      input.trimHeightCm ?? null,
      input.tensionLeft === null || input.tensionLeft === undefined
        ? null
        : Number(input.tensionLeft),
      input.tensionRight === null || input.tensionRight === undefined
        ? null
        : Number(input.tensionRight),
      context.waterLevelCm,
      context.dischargeCms,
      input.note ?? null,
      input.id,
    )
    .first<PlatformSetupLogRow>();

  if (!result) throw new Error("Setup-Wert wurde nicht gefunden");
  return rowToLog(result);
}

export async function getPlatformSetupLogs(limit = 40) {
  const db = getD1();
  const safeLimit = Math.min(200, Math.max(1, Math.round(limit)));
  const result = await db
    .prepare(
      `SELECT
        id,
        logged_at,
        created_at,
        wave_master,
        chain_left_cm,
        chain_right_cm,
        ramp_position,
        trim_height_cm,
        tension_left,
        tension_right,
        water_level_cm,
        discharge_cms,
        note,
        created_by
       FROM platform_setup_logs
       ORDER BY logged_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<PlatformSetupLogRow>();

  return (result.results ?? []).map(rowToLog);
}

export async function deletePlatformSetupLog(id: number) {
  const db = getD1();
  const result = await db
    .prepare("DELETE FROM platform_setup_logs WHERE id = ?")
    .bind(id)
    .run();

  return result.meta.changes ?? 0;
}
