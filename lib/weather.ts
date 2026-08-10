export type WeatherStation = {
  id: string;
  shortName: string;
  name: string;
  region: string;
  climateId: string;
  tawesId: string;
  latLon: [number, number];
  altitude: number;
};

export type WeatherPoint = {
  t: number;
  stationId: string;
  rainMm: number | null;
  source: "GeoSphere Klima" | "GeoSphere TAWES" | "GeoSphere Nowcast";
};

export type WeatherPayload = {
  fetchedAt: string;
  source: string;
  stations: WeatherStation[];
  history: WeatherPoint[];
  forecast?: WeatherPoint[];
  historySource?: "database" | "geosphere" | "mixed";
  collector?: {
    ok: boolean;
    collectedAt?: string;
    writes?: number;
    error?: string;
  };
};

type GeoSphereFeature = {
  properties?: {
    station?: string | number;
    parameters?: Record<
      string,
      {
        data?: (number | null)[];
        unit?: string;
      }
    >;
  };
};

type GeoSphereResponse = {
  timestamps?: string[];
  features?: GeoSphereFeature[];
};

export const weatherStations: WeatherStation[] = [
  {
    id: "innsbruck_uni",
    shortName: "Innsbruck Uni",
    name: "Innsbruck Universität",
    region: "Innsbruck",
    climateId: "39",
    tawesId: "11320",
    latLon: [47.25986, 11.38425],
    altitude: 578,
  },
  {
    id: "neustift",
    shortName: "Neustift",
    name: "Neustift/Milders",
    region: "Stubaital",
    climateId: "14701",
    tawesId: "11324",
    latLon: [47.10278, 11.29194],
    altitude: 1007,
  },
  {
    id: "steinach",
    shortName: "Steinach",
    name: "Steinach am Brenner",
    region: "Wipptal",
    climateId: "139",
    tawesId: "11329",
    latLon: [47.09833, 11.46611],
    altitude: 1036,
  },
  {
    id: "brenner",
    shortName: "Brenner",
    name: "Brenner",
    region: "Wipptal",
    climateId: "16",
    tawesId: "11129",
    latLon: [47.00722, 11.51083],
    altitude: 1412,
  },
  {
    id: "patscherkofel",
    shortName: "Patscherkofel",
    name: "Patscherkofel",
    region: "Alpin",
    climateId: "196",
    tawesId: "11126",
    latLon: [47.20889, 11.46222],
    altitude: 2251,
  },
];

const climateById = new Map(weatherStations.map((station) => [station.climateId, station]));
const tawesById = new Map(weatherStations.map((station) => [station.tawesId, station]));

const GEOSPHERE_BASE = "https://dataset.api.hub.geosphere.at/v1";

function isoMinute(value: number) {
  return new Date(value).toISOString().slice(0, 16);
}

function valueOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStationPoints(
  data: GeoSphereResponse,
  parameter: "rr" | "RR",
  stationMap: Map<string, WeatherStation>,
  source: WeatherPoint["source"],
) {
  const timestamps = data.timestamps ?? [];
  const points: WeatherPoint[] = [];

  for (const feature of data.features ?? []) {
    const sourceStationId = String(feature.properties?.station ?? "");
    const station = stationMap.get(sourceStationId);
    const values = feature.properties?.parameters?.[parameter]?.data ?? [];
    if (!station) continue;

    values.forEach((value, index) => {
      const t = new Date(timestamps[index] ?? "").getTime();
      if (!Number.isFinite(t)) return;
      points.push({
        t,
        stationId: station.id,
        rainMm: valueOrNull(value),
        source,
      });
    });
  }

  return points;
}

function parseForecastPoints(data: GeoSphereResponse) {
  const timestamps = data.timestamps ?? [];
  const points: WeatherPoint[] = [];

  (data.features ?? []).forEach((feature, featureIndex) => {
    const station = weatherStations[featureIndex];
    const values = feature.properties?.parameters?.rr?.data ?? [];
    if (!station) return;

    values.forEach((value, index) => {
      const t = new Date(timestamps[index] ?? "").getTime();
      if (!Number.isFinite(t)) return;
      points.push({
        t,
        stationId: station.id,
        rainMm: valueOrNull(value),
        source: "GeoSphere Nowcast",
      });
    });
  });

  return points;
}

export function compactWeatherHistory(points: WeatherPoint[], maxPoints = 50000) {
  const byStationAndTime = new Map<string, WeatherPoint>();

  for (const point of points) {
    if (!Number.isFinite(point.t)) continue;
    const t = point.t;
    byStationAndTime.set(`${point.stationId}:${t}`, { ...point, t });
  }

  return [...byStationAndTime.values()]
    .sort((a, b) => a.t - b.t || a.stationId.localeCompare(b.stationId))
    .slice(-maxPoints);
}

export async function fetchWeatherCurrent() {
  const ids = weatherStations.map((station) => station.tawesId).join(",");
  const response = await fetch(
    `${GEOSPHERE_BASE}/station/current/tawes-v1-10min?parameters=RR&station_ids=${ids}`,
    {
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("GeoSphere Live-Regen konnte nicht geladen werden");
  }

  return parseStationPoints(
    (await response.json()) as GeoSphereResponse,
    "RR",
    tawesById,
    "GeoSphere TAWES",
  );
}

export async function fetchWeatherHistorical(hours = 72) {
  const safeHours = Math.min(365 * 24, Math.max(1, Math.round(hours)));
  const end = Date.now();
  const start = end - safeHours * 60 * 60 * 1000;
  const ids = weatherStations.map((station) => station.climateId).join(",");
  const response = await fetch(
    `${GEOSPHERE_BASE}/station/historical/klima-v2-10min?parameters=rr&station_ids=${ids}&start=${isoMinute(
      start,
    )}&end=${isoMinute(end)}`,
    {
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("GeoSphere Regenhistorie konnte nicht geladen werden");
  }

  return parseStationPoints(
    (await response.json()) as GeoSphereResponse,
    "rr",
    climateById,
    "GeoSphere Klima",
  );
}

export async function fetchWeatherForecast() {
  const latLon = weatherStations
    .map((station) => `lat_lon=${station.latLon[0]},${station.latLon[1]}`)
    .join("&");
  const response = await fetch(
    `${GEOSPHERE_BASE}/timeseries/forecast/nowcast-v1-15min-1km?parameters=rr&${latLon}`,
    {
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("GeoSphere Regenforecast konnte nicht geladen werden");
  }

  return parseForecastPoints((await response.json()) as GeoSphereResponse);
}

export function emptyWeatherPayload(): WeatherPayload {
  return {
    fetchedAt: new Date().toISOString(),
    source: "GeoSphere Austria",
    stations: weatherStations,
    history: [],
    forecast: [],
  };
}
