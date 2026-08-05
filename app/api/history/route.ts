import { getHydroArchiveRows, type HydroArchiveRow } from "@/db/hydro-history";

const csvHeader = [
  "station_id",
  "station_name",
  "measured_at_iso",
  "collected_at_iso",
  "water_value",
  "water_unit",
  "water_classification",
  "water_tendency",
  "discharge_value",
  "discharge_unit",
];

function csvCell(value: number | string | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function archiveRowToCsv(row: HydroArchiveRow) {
  return [
    row.station_id,
    row.short_name,
    new Date(row.measured_at).toISOString(),
    new Date(row.collected_at).toISOString(),
    row.water_value,
    row.water_unit,
    row.water_classification,
    row.water_tendency,
    row.discharge_value,
    row.discharge_unit,
  ]
    .map(csvCell)
    .join(",");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? "7");
  const safeDays = Math.min(365, Math.max(1, Math.round(days)));
  const rows = await getHydroArchiveRows(safeDays);
  const format = url.searchParams.get("format") ?? "json";

  if (format === "csv") {
    const csv = [csvHeader.join(","), ...rows.map(archiveRowToCsv)].join("\n");
    return new Response(csv, {
      headers: {
        "content-disposition": `attachment; filename="sill-archiv-${safeDays}-tage.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  }

  return Response.json({
    days: safeDays,
    rows,
    rowCount: rows.length,
    exportedAt: new Date().toISOString(),
  });
}
