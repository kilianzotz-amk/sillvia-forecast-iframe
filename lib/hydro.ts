export type HydroValue = {
  value: number | null;
  unit: string;
  dt: number | null;
  classification?: string;
  tendency?: number;
};

export type HydroStation = {
  id: string;
  shortName: string;
  name: string;
  river: string;
  role: string;
  altitude: number | null;
  waveRuntime?: string | null;
  latlng: [number, number] | null;
  water: HydroValue;
  discharge: HydroValue;
  thresholds: {
    hw1: HydroValue;
    hw30: HydroValue;
  };
  statistics: {
    hhq: HydroValue;
    nnq: HydroValue;
    nqt: HydroValue;
  };
};

export type HistoryPoint = {
  t: number;
  kroessbach: number | null;
  puig: number | null;
  reichenau: number | null;
  kroessbachLevel: number | null;
  puigLevel: number | null;
  reichenauLevel: number | null;
};

export type HydroPayload = {
  fetchedAt: string;
  source: string;
  stations: HydroStation[];
  history?: HistoryPoint[];
  historySource?: "database" | "local";
};

export const stationOrder = ["202283", "201574", "201624"];
export const sampleInterval = 15 * 60 * 1000;

const DATA_URL =
  "https://hydro.tirol.gv.at/stationdata/data.json?parameter=Wasserstand";

const targets = [
  {
    id: "202283",
    shortName: "Krössbach",
    role: "Zufluss aus dem Stubaital",
  },
  {
    id: "201574",
    shortName: "Puig",
    role: "Oberlieger an der Sill",
  },
  {
    id: "201624",
    shortName: "Reichenau",
    role: "Unterlieger nach Zusammenfluss",
  },
];

type RawValue = {
  v?: number;
  unit?: string;
  dt?: number;
  classification?: string;
  tendency?: number;
};

type RawStation = {
  altitude?: number;
  "HW-Laufzeiten"?: string;
  latlng?: [number, number];
  name: string;
  number: string;
  values?: Record<string, Record<string, RawValue>>;
  WTO_OBJECT?: string;
};

function emptyValue(unit = "") {
  return { value: null, unit, dt: null };
}

function valueFrom(
  raw: RawStation | undefined,
  parameter: string,
  preferredKeys: string[],
  unit = "",
) {
  const series = raw?.values?.[parameter];
  if (!series) return emptyValue(unit);
  const key =
    preferredKeys.find((key) => series[key]?.v !== undefined) ??
    preferredKeys.find((key) => series[key]) ??
    Object.keys(series).find((key) => series[key]?.v !== undefined);
  const value = key ? series[key] : undefined;

  return {
    value: value?.v ?? null,
    unit: value?.unit ?? unit,
    dt: value?.dt ?? null,
    classification: value?.classification,
    tendency: value?.tendency,
  };
}

export function valueOrNull(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function timeFromStations(stations: HydroStation[]) {
  return (
    stations
      .flatMap((station) => [station.discharge.dt, station.water.dt])
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => b - a)[0] ?? Date.now()
  );
}

export function historyPointFromPayload(payload: HydroPayload): HistoryPoint | null {
  const stations = Object.fromEntries(
    payload.stations.map((station) => [station.id, station]),
  );
  const point = {
    t: timeFromStations(payload.stations),
    kroessbach: valueOrNull(stations["202283"]?.discharge.value),
    puig: valueOrNull(stations["201574"]?.discharge.value),
    reichenau: valueOrNull(stations["201624"]?.discharge.value),
    kroessbachLevel: valueOrNull(stations["202283"]?.water.value),
    puigLevel: valueOrNull(stations["201574"]?.water.value),
    reichenauLevel: valueOrNull(stations["201624"]?.water.value),
  };

  if (
    point.kroessbach === null &&
    point.puig === null &&
    point.reichenau === null &&
    point.kroessbachLevel === null &&
    point.puigLevel === null &&
    point.reichenauLevel === null
  ) {
    return null;
  }

  return point;
}

export function compactHistory(points: HistoryPoint[], maxPoints = 5000) {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const compacted: HistoryPoint[] = [];

  for (const point of sorted) {
    const previous = compacted[compacted.length - 1];
    if (previous && Math.abs(point.t - previous.t) < sampleInterval / 3) {
      compacted[compacted.length - 1] = point;
    } else {
      compacted.push(point);
    }
  }

  return compacted.slice(-maxPoints);
}

export async function fetchHydroPayload(): Promise<HydroPayload> {
  const response = await fetch(DATA_URL, {
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Hydro Tirol konnte nicht geladen werden");
  }

  const rawStations = (await response.json()) as RawStation[];
  const stations = targets.map((target) => {
    const raw = rawStations.find((station) => station.number === target.id);
    const water = valueFrom(raw, "W", ["Cmd"], "cm");
    const discharge = valueFrom(raw, "Q", ["15m.Cmd.HD", "Cmd"], "m³/s");

    return {
      id: target.id,
      shortName: target.shortName,
      name: raw?.name ?? target.shortName,
      river: raw?.WTO_OBJECT ?? "",
      role: target.role,
      altitude: raw?.altitude ?? null,
      waveRuntime: raw?.["HW-Laufzeiten"] ?? null,
      latlng: raw?.latlng ?? null,
      water,
      discharge,
      thresholds: {
        hw1: valueFrom(raw, "W", ["Cmd.Schwellen.HW1"], "cm"),
        hw30: valueFrom(raw, "W", ["Cmd.Schwellen.HW30"], "cm"),
      },
      statistics: {
        hhq: valueFrom(raw, "Q", ["Cmd.Statistik.HHQ"], "m³/s"),
        nnq: valueFrom(raw, "Q", ["Cmd.Statistik.NNQ"], "m³/s"),
        nqt: valueFrom(raw, "Q", ["Cmd.Statistik.NQT"], "m³/s"),
      },
    };
  });

  return {
    fetchedAt: new Date().toISOString(),
    source: "Hydro Online Tirol",
    stations,
  };
}
