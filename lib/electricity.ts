export type ElectricityPricePoint = {
  t: number;
  end: number;
  marketPriceEurMwh: number | null;
  unit: "Eur/MWh";
  source: "aWATTar";
};

export type ElectricityPayload = {
  fetchedAt: string;
  source: string;
  history: ElectricityPricePoint[];
  forecast: ElectricityPricePoint[];
  historySource?: "database" | "awattar" | "mixed";
  error?: string;
};

type AwattarMarketDataPoint = {
  start_timestamp?: number;
  end_timestamp?: number;
  marketprice?: number;
  unit?: string;
};

type AwattarMarketDataResponse = {
  object?: string;
  data?: AwattarMarketDataPoint[];
};

const AWATTAR_BASE = "https://api.awattar.at/v1/marketdata";

function valueOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseAwattarPoints(data: AwattarMarketDataResponse) {
  return (data.data ?? [])
    .map((point) => {
      const t = Number(point.start_timestamp);
      const end = Number(point.end_timestamp);
      if (!Number.isFinite(t) || !Number.isFinite(end)) return null;

      return {
        t,
        end,
        marketPriceEurMwh: valueOrNull(point.marketprice),
        unit: "Eur/MWh" as const,
        source: "aWATTar" as const,
      };
    })
    .filter((point): point is ElectricityPricePoint => point !== null)
    .sort((a, b) => a.t - b.t);
}

export function compactElectricityPrices(
  points: ElectricityPricePoint[],
  maxPoints = 10000,
) {
  const byStart = new Map<number, ElectricityPricePoint>();

  for (const point of points) {
    if (!Number.isFinite(point.t)) continue;
    byStart.set(point.t, point);
  }

  return [...byStart.values()].sort((a, b) => a.t - b.t).slice(-maxPoints);
}

export async function fetchElectricityPrices(start: number, end: number) {
  const response = await fetch(
    `${AWATTAR_BASE}?start=${Math.round(start)}&end=${Math.round(end)}`,
    {
      cache: "no-store",
      headers: { accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("aWATTar Strompreise konnten nicht geladen werden");
  }

  return parseAwattarPoints((await response.json()) as AwattarMarketDataResponse);
}

export async function fetchElectricityCurrent() {
  const now = Date.now();
  return fetchElectricityPrices(now - 24 * 60 * 60 * 1000, now + 36 * 60 * 60 * 1000);
}

export async function fetchElectricityHistorical(hours = 72) {
  const safeHours = Math.min(365 * 24, Math.max(1, Math.round(hours)));
  const end = Date.now();
  const start = end - safeHours * 60 * 60 * 1000;

  return fetchElectricityPrices(start, end + 36 * 60 * 60 * 1000);
}

export function emptyElectricityPayload(): ElectricityPayload {
  return {
    fetchedAt: new Date().toISOString(),
    source: "aWATTar / EPEX Spot",
    history: [],
    forecast: [],
    historySource: "awattar",
  };
}
