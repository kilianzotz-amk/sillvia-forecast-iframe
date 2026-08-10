import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const hydroMeasurements = sqliteTable(
  "hydro_measurements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stationId: text("station_id").notNull(),
    shortName: text("short_name").notNull(),
    measuredAt: integer("measured_at").notNull(),
    collectedAt: integer("collected_at").notNull(),
    waterValue: real("water_value"),
    waterUnit: text("water_unit"),
    waterClassification: text("water_classification"),
    waterTendency: integer("water_tendency"),
    dischargeValue: real("discharge_value"),
    dischargeUnit: text("discharge_unit"),
  },
  (table) => [
    uniqueIndex("hydro_measurements_station_measured_idx").on(
      table.stationId,
      table.measuredAt,
    ),
  ],
);

export const surfObservations = sqliteTable("surf_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  observedAt: integer("observed_at").notNull(),
  createdAt: integer("created_at").notNull(),
  trim: text("trim").notNull(),
  trimCm: real("trim_cm"),
  quality: integer("quality").notNull(),
  contextMeasuredAt: integer("context_measured_at"),
  kroessbachDischarge: real("kroessbach_discharge"),
  puigDischarge: real("puig_discharge"),
  reichenauDischarge: real("reichenau_discharge"),
  kroessbachLevel: real("kroessbach_level"),
  puigLevel: real("puig_level"),
  reichenauLevel: real("reichenau_level"),
  note: text("note"),
  createdBy: text("created_by"),
});

export const platformSetupLogs = sqliteTable("platform_setup_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loggedAt: integer("logged_at").notNull(),
  createdAt: integer("created_at").notNull(),
  waveMaster: text("wave_master"),
  chainLeftCm: real("chain_left_cm"),
  chainRightCm: real("chain_right_cm"),
  rampPosition: text("ramp_position"),
  trimHeightCm: real("trim_height_cm"),
  tensionLeft: integer("tension_left", { mode: "boolean" }),
  tensionRight: integer("tension_right", { mode: "boolean" }),
  waterLevelCm: real("water_level_cm"),
  dischargeCms: real("discharge_cms"),
  note: text("note"),
  createdBy: text("created_by"),
});
