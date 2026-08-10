"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

type HydroValue = {
  value: number | null;
  unit: string;
  dt: number | null;
  classification?: string;
  tendency?: number;
};

type HydroStation = {
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

type HydroPayload = {
  fetchedAt: string;
  source: string;
  stations: HydroStation[];
  history?: HistoryPoint[];
  historySource?: "database" | "local";
  collector?: {
    ok: boolean;
    collectedAt?: string;
    writes?: number;
    error?: string;
  };
};

type WeatherStation = {
  id: string;
  shortName: string;
  name: string;
  region: string;
  climateId: string;
  tawesId: string;
  latLon: [number, number];
  altitude: number;
};

type WeatherPoint = {
  t: number;
  stationId: string;
  rainMm: number | null;
  source: "GeoSphere Klima" | "GeoSphere TAWES";
};

type WeatherPayload = {
  fetchedAt: string;
  source: string;
  stations: WeatherStation[];
  history: WeatherPoint[];
  historySource?: "database" | "geosphere" | "mixed";
  error?: string;
};

type HistoryPoint = {
  t: number;
  kroessbach: number | null;
  puig: number | null;
  reichenau: number | null;
  kroessbachLevel: number | null;
  puigLevel: number | null;
  reichenauLevel: number | null;
};

type SurfObservation = {
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

type PlatformSetupLog = {
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

type ManualQualitySignal = {
  score: number;
  quality: number;
  trim: string;
  trimCm: number | null;
  observedAt: number;
};

type DataQualitySignal = {
  score: number | null;
  confidence: number;
  label: "schwach" | "vorsichtig" | "brauchbar";
  sampleSize: number;
  sameSetupCount: number;
  matchedCount: number;
  basis: "gleiches Setup" | "altes Setup" | "gemischt" | "keine Daten";
  note: string;
};

type WaveQualityProjection = {
  time: number;
  delta: number;
  upstream: number;
  trend: InflowTrend;
  level: number | null;
  volumeBalance60: number | null;
  score: number;
  modelScore: number;
  data: DataQualitySignal;
  dataScore: number;
  manual: ManualQualitySignal | null;
};

type RuntimeComparisonPoint = {
  t: number;
  expected: number;
  measured: number;
  delta: number;
  kroessbach: number | null;
  puig: number | null;
};

type RuntimeComparisonSummary = {
  count: number;
  correlation: number | null;
  kroessbachCorrelation: number | null;
  puigCorrelation: number | null;
  meanDelta: number | null;
  meanAbsoluteDelta: number | null;
  latest: RuntimeComparisonPoint | null;
};

type InflowTrend = {
  current: number | null;
  before30: number | null;
  before60: number | null;
  delta30: number | null;
  delta60: number | null;
  label: "steigend" | "fallend" | "stabil" | "unklar";
  tone: "up" | "down" | "flat" | "unknown";
};

type TimeDomain = {
  min: number;
  max: number;
};

type ForecastSettings = {
  lagKroessbach: number;
  lagPuig: number;
  waveOffset: number;
  surfMin: number;
  surfMax: number;
  levelMin: number;
  levelMax: number;
};

type ReviewPreset = "12h" | "24h" | "week" | "month" | "year" | "all" | "custom";

type ReviewRange = {
  preset: ReviewPreset;
  fromDate: string;
  toDate: string;
};

type TimeZoom = {
  detail: number;
  position: number;
};

type TimeDrag = {
  x: number;
  position: number;
};

type FlowSeriesKey =
  | "trim"
  | "kroessbach"
  | "puig"
  | "upstream"
  | "reichenau"
  | "forecast"
  | "session"
  | "range";

type DeltaSeriesKey = "delta";

type VolumeSeriesKey = "volume60";

type LevelSeriesKey = "kroessbach" | "puig" | "reichenau" | "range";

type RainSeriesKey =
  | "area"
  | "innsbruck_uni"
  | "neustift"
  | "steinach"
  | "brenner"
  | "patscherkofel";

const stationOrder = ["202283", "201574", "201624"];
const historyStorageKey = "sill-surf-forecast-history-v1";
const settingsStorageKey = "sill-surf-forecast-settings-v1";
const reviewRangeStorageKey = "sill-surf-review-range-v1";
const sampleInterval = 15 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const platformSetupChangeAt = new Date("2026-08-06T00:00:00+02:00").getTime();
const defaultForecastSettings: ForecastSettings = {
  lagKroessbach: 115,
  lagPuig: 90,
  waveOffset: 10,
  surfMin: 14,
  surfMax: 22,
  levelMin: 240,
  levelMax: 285,
};
const defaultReviewRange: ReviewRange = {
  preset: "24h",
  fromDate: "",
  toDate: "",
};
const defaultTimeZoom: TimeZoom = {
  detail: 0,
  position: 100,
};
const defaultWeatherPayload: WeatherPayload = {
  fetchedAt: new Date().toISOString(),
  source: "GeoSphere Austria",
  history: [],
  stations: [
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
  ],
};
const reviewPresets: { id: ReviewPreset; label: string }[] = [
  { id: "12h", label: "12 h" },
  { id: "24h", label: "24 h" },
  { id: "week", label: "Letzte Woche" },
  { id: "month", label: "Letzter Monat" },
  { id: "year", label: "Jahr" },
  { id: "all", label: "Alle Daten" },
  { id: "custom", label: "Zeitraum" },
];
const spotInsightSummary = {
  sample: "27 Spotinfos aus 36 SurfInn Sessions",
  good: [
    {
      label: "Rippable Fenster",
      value: "ca. 16-22 m³/s",
      detail: "oft gut, wenn Reichenau ruhig bleibt und der Pegel grob im 276-284 cm Bereich liegt.",
    },
    {
      label: "Kanal / KW",
      value: "kontrollierter Zufluss",
      detail: "kann Druck geben, solange die Sill nicht sprunghaft hochkommt.",
    },
    {
      label: "Trim-Hinweis",
      value: "220-225 cm",
      detail: "taucht mehrfach als brauchbarer Bereich auf; niedriger bedeutet stärker getrimmt.",
    },
  ],
  bad: [
    {
      label: "Sill-Spikes",
      value: "schneller Anstieg",
      detail: "Spotinfos nennen dann oft abgesoffen, braunes Wasser, Treibgut oder stark wechselnde Welle.",
    },
    {
      label: "Hoher Pegel",
      value: "> ca. 290 cm",
      detail: "tendenziell weniger Halt und mehr Weißwasser; es gibt aber Ausnahmen.",
    },
    {
      label: "Zu wenig Kanal",
      value: "wenig Druck",
      detail: "bei niedrigem Zufluss wirkt die Welle eher klein oder schwach.",
    },
  ],
};

const fallbackPayload: HydroPayload = {
  fetchedAt: new Date().toISOString(),
  source: "Hydro Online Tirol",
  stations: [
    {
      id: "202283",
      shortName: "Krössbach",
      name: "Krössbach",
      river: "Ruetz",
      role: "Zufluss aus dem Stubaital",
      altitude: 1086,
      waveRuntime:
        "Laufzeit der Hochwasserwelle bis zum Pegel Reichenau: 1,25-2,5 Stunden; Fließstrecke 29,9 km",
      latlng: [47.080286341504, 11.266120553361],
      water: {
        value: 107.1,
        unit: "cm",
        dt: 1785844800000,
        classification: ">MW",
        tendency: 2,
      },
      discharge: { value: 13.526, unit: "m3/s", dt: 1785844800000 },
      thresholds: {
        hw1: { value: 157.091, unit: "cm", dt: 1785884400000 },
        hw30: { value: 234.543, unit: "cm", dt: 1785884400000 },
      },
      statistics: {
        hhq: { value: 115, unit: "m3/s", dt: 677113200000 },
        nnq: { value: 0.067, unit: "m3/s", dt: 1329778800000 },
        nqt: { value: 0.196, unit: "m3/s", dt: 698454000000 },
      },
    },
    {
      id: "201574",
      shortName: "Puig",
      name: "Puig (Matrei am Brenner)",
      river: "Sill",
      role: "Oberlieger an der Sill",
      altitude: 1005,
      waveRuntime:
        "Laufzeit der Hochwasserwelle bis zum Pegel Reichenau: 1-2 Stunden; Fließstrecke 24,3 km",
      latlng: [47.1130710390252, 11.4523841611937],
      water: {
        value: 101.5,
        unit: "cm",
        dt: 1785844800000,
        classification: "niedrig",
        tendency: 0,
      },
      discharge: { value: 5.704, unit: "m3/s", dt: 1785844800000 },
      thresholds: {
        hw1: { value: 203.506, unit: "cm", dt: 1785884400000 },
        hw30: { value: 279.919, unit: "cm", dt: 1785884400000 },
      },
      statistics: {
        hhq: { value: 127, unit: "m3/s", dt: 867452400000 },
        nnq: { value: 1.7, unit: "m3/s", dt: -498790800000 },
        nqt: { value: 1.87, unit: "m3/s", dt: -498963600000 },
      },
    },
    {
      id: "201624",
      shortName: "Reichenau",
      name: "Innsbruck Reichenau",
      river: "Sill",
      role: "Unterlieger nach Zusammenfluss",
      altitude: 567,
      waveRuntime: null,
      latlng: [47.2728990628016, 11.4115312552712],
      water: {
        value: 274.7,
        unit: "cm",
        dt: 1785844800000,
        classification: "niedrig",
        tendency: -1,
      },
      discharge: { value: 15.661, unit: "m3/s", dt: 1785844800000 },
      thresholds: {
        hw1: { value: 395.785, unit: "cm", dt: 1785884400000 },
        hw30: { value: 532.772, unit: "cm", dt: 1785884400000 },
      },
      statistics: {
        hhq: { value: 358, unit: "m3/s", dt: 492130800000 },
        nnq: { value: 0.561, unit: "m3/s", dt: 288313200000 },
        nqt: { value: 4, unit: "m3/s", dt: -504061200000 },
      },
    },
  ],
};

function formatNumber(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("de-AT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatDate(value: string | number | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Vienna",
  }).format(new Date(value));
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  }).format(new Date(value));
}

function formatDateTimeInput(value: number) {
  const date = new Date(value);
  const localTime = value - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTime).toISOString().slice(0, 16);
}

function parseDateTimeInput(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStartDate(value: string) {
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEndDate(value: string) {
  const parsed = new Date(value.includes("T") ? value : `${value}T23:59:59`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function dateInputValue(value: string) {
  if (!value) return "";
  if (!value.includes("T")) return value;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  const localTime = parsed - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function formatAxisTime(value: number, span: number) {
  if (span <= 30 * 60 * 60 * 1000) return formatTime(value);
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  }).format(new Date(value));
}

function timeGridTicks(minT: number, maxT: number) {
  const span = maxT - minT;
  const halfHour = 30 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const step =
    span <= 12 * hour
      ? halfHour
      : span <= 36 * hour
        ? hour
        : span <= 7 * day
          ? 6 * hour
          : day;
  const first = Math.ceil(minT / step) * step;
  const ticks: { t: number; major: boolean }[] = [];

  for (let t = first; t <= maxT; t += step) {
    ticks.push({ t, major: t % hour === 0 });
  }

  return ticks;
}

function timeAxisTicks(minT: number, maxT: number) {
  const span = maxT - minT;
  const gridTicks = timeGridTicks(minT, maxT);
  const hour = 60 * 60 * 1000;

  if (span <= 5 * hour) return gridTicks.map((tick) => tick.t);
  if (span <= 12 * hour) return gridTicks.filter((tick) => tick.major).map((tick) => tick.t);

  return Array.from({ length: 5 }, (_, index) =>
    minT + ((maxT - minT) / 4) * index,
  );
}

function zoomTimeDomain(domain: TimeDomain, zoom: TimeZoom) {
  const span = Math.max(1, domain.max - domain.min);
  const minSpan = Math.min(span, 60 * 60 * 1000);
  const detail = clamp(zoom.detail, 0, 100) / 100;
  const zoomFactor = Math.pow(span / Math.max(1, minSpan), detail);
  const visibleSpan = span / zoomFactor;
  const maxOffset = Math.max(0, span - visibleSpan);
  const offset = maxOffset * (clamp(zoom.position, 0, 100) / 100);

  return {
    min: domain.min + offset,
    max: domain.min + offset + visibleSpan,
  };
}

function formatUnit(unit: string) {
  return unit.replace("m3/s", "m³/s");
}

function formatTrimCm(value: number | null, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${formatNumber(value, value % 1 === 0 ? 0 : 1)} cm`;
  }

  return fallback || "n/a";
}

function formatSignedNumber(value: number | null, digits = 2) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatCorrelation(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return formatNumber(value, 2);
}

function formatTriple(
  kroessbach: number | null,
  puig: number | null,
  reichenau: number | null,
  digits: number,
) {
  return `${formatNumber(kroessbach, digits)} / ${formatNumber(
    puig,
    digits,
  )} / ${formatNumber(reichenau, digits)}`;
}

function tendencyLabel(tendency?: number) {
  if (tendency === undefined) return "stabil";
  if (tendency > 0) return "steigend";
  if (tendency < 0) return "fallend";
  return "stabil";
}

function pct(value: number | null, target: number | null) {
  if (value === null || target === null || target <= 0) return 0;
  return Math.min(100, Math.max(0, (value / target) * 100));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, select, textarea, a, label"))
  );
}

function ratingClass(quality: number) {
  const rounded = Math.round(clamp(quality, 1, 5));
  return `rating-${rounded}`;
}

function formatQuality(value: number) {
  return formatNumber(value, 1);
}

function formatVolume(value: number | null) {
  if (value === null) return "n/a";
  const absolute = Math.abs(value);
  const digits = absolute >= 1000 ? 0 : 1;
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatVolumeBalanceFlow(value: number | null) {
  if (value === null) return "n/a";
  const averageFlow = value / 3600;
  return `${averageFlow >= 0 ? "+" : ""}${formatNumber(averageFlow, 2)}`;
}

function formatOptionalCm(value: number | null) {
  return value === null ? "-" : `${formatNumber(value, value % 1 === 0 ? 0 : 1)} cm`;
}

function formatSetupPair(left: number | null, right: number | null) {
  return `${formatOptionalCm(left)} / ${formatOptionalCm(right)}`;
}

function formatBooleanFlag(value: boolean | null) {
  if (value === null) return "-";
  return value ? "Ja" : "Nein";
}

function emptySetupForm(loggedAt = formatDateTimeInput(platformSetupChangeAt)) {
  return {
    loggedAt,
    waveMaster: "",
    chainLeftCm: "",
    chainRightCm: "",
    rampPosition: "",
    trimHeightCm: "",
    tensionLeft: "",
    tensionRight: "",
    waterLevelCm: "",
    dischargeCms: "",
    note: "",
  };
}

function setupFormFromLog(log: PlatformSetupLog) {
  return {
    loggedAt: formatDateTimeInput(log.loggedAt),
    waveMaster: log.waveMaster ?? "",
    chainLeftCm: log.chainLeftCm === null ? "" : String(log.chainLeftCm),
    chainRightCm: log.chainRightCm === null ? "" : String(log.chainRightCm),
    rampPosition: log.rampPosition ?? "",
    trimHeightCm: log.trimHeightCm === null ? "" : String(log.trimHeightCm),
    tensionLeft: log.tensionLeft === null ? "" : String(log.tensionLeft),
    tensionRight: log.tensionRight === null ? "" : String(log.tensionRight),
    waterLevelCm: log.waterLevelCm === null ? "" : formatNumber(log.waterLevelCm, 1),
    dischargeCms: log.dischargeCms === null ? "" : formatNumber(log.dischargeCms, 2),
    note: log.note ?? "",
  };
}

function sortSetupLogs(logs: PlatformSetupLog[]) {
  return [...logs].sort((a, b) => b.loggedAt - a.loggedAt || b.id - a.id);
}

function sortSurfObservations(observations: SurfObservation[]) {
  return [...observations].sort(
    (a, b) => b.observedAt - a.observedAt || b.id - a.id,
  );
}

function qualityLabel(score: number) {
  if (score >= 75) return "gut";
  if (score >= 50) return "okay";
  if (score >= 30) return "kritisch";
  return "schwach";
}

function qualityTone(score: number) {
  if (score >= 75) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

function inflowTrendLabel(delta60: number | null) {
  if (delta60 === null) return "unklar";
  if (delta60 >= 0.8) return "steigend";
  if (delta60 <= -0.8) return "fallend";
  return "stabil";
}

function inflowTrendTone(label: InflowTrend["label"]) {
  if (label === "steigend") return "up";
  if (label === "fallend") return "down";
  if (label === "stabil") return "flat";
  return "unknown";
}

function waveQualityScore(
  delta: number,
  upstream: number,
  level: number | null,
  surfMin: number,
  surfMax: number,
  levelMin: number,
  levelMax: number,
  balance60: number | null = null,
) {
  const sortedMin = Math.min(surfMin, surfMax);
  const sortedMax = Math.max(surfMin, surfMax);
  const sortedLevelMin = Math.min(levelMin, levelMax);
  const sortedLevelMax = Math.max(levelMin, levelMax);
  const deltaScore = clamp(55 + delta * 14);
  const upstreamPressure =
    sortedMax <= sortedMin
      ? upstream / Math.max(1, sortedMax)
      : (upstream - sortedMin) / Math.max(1, sortedMax - sortedMin);
  const upstreamScore = clamp(100 - clamp(upstreamPressure, 0, 1.4) * 70);
  const levelScore =
    level === null
      ? 82
      : level > sortedLevelMax
        ? clamp(100 - ((level - sortedLevelMax) / Math.max(1, sortedLevelMax - sortedLevelMin)) * 90)
        : level < sortedLevelMin
          ? clamp(78 - ((sortedLevelMin - level) / Math.max(1, sortedLevelMin)) * 25)
          : 100;
  const volumeScore =
    balance60 === null ? 70 : clamp(50 + balance60 / 72);

  return Math.round(
    clamp(
      deltaScore * 0.48 +
        upstreamScore * 0.22 +
        levelScore * 0.18 +
        volumeScore * 0.12,
    ),
  );
}

function observationScore(quality: number) {
  return clamp(quality * 20);
}

function recentManualSignal(
  observations: SurfObservation[],
  referenceTime: number,
): ManualQualitySignal | null {
  const latest = observations
    .filter(
      (observation) =>
        observation.observedAt <= referenceTime &&
        referenceTime - observation.observedAt <= 6 * 60 * 60 * 1000,
    )
    .sort((a, b) => b.observedAt - a.observedAt)[0];

  if (!latest) return null;
  return {
    score: observationScore(latest.quality),
    quality: latest.quality,
    trim: latest.trim,
    trimCm: latest.trimCm,
    observedAt: latest.observedAt,
  };
}

function isRealObservation(observation: SurfObservation) {
  return !(observation.note ?? "").toLowerCase().includes("test");
}

function observationDataFeatures(observation: SurfObservation) {
  const upstream =
    observation.kroessbachDischarge === null && observation.puigDischarge === null
      ? null
      : (observation.kroessbachDischarge ?? 0) + (observation.puigDischarge ?? 0);
  const delta =
    observation.reichenauDischarge === null || upstream === null
      ? null
      : observation.reichenauDischarge - upstream;

  return {
    upstream,
    reichenau: observation.reichenauDischarge,
    level: observation.reichenauLevel,
    delta,
  };
}

function dataSimilarity(
  target: {
    delta: number;
    upstream: number;
    level: number | null;
    reichenau: number | null;
  },
  features: ReturnType<typeof observationDataFeatures>,
) {
  const parts: number[] = [];

  if (features.delta !== null) parts.push(Math.abs(target.delta - features.delta) / 1.8);
  if (features.upstream !== null) {
    parts.push(Math.abs(target.upstream - features.upstream) / 4);
  }
  if (features.level !== null && target.level !== null) {
    parts.push(Math.abs(target.level - features.level) / 7);
  }
  if (features.reichenau !== null && target.reichenau !== null) {
    parts.push(Math.abs(target.reichenau - features.reichenau) / 4);
  }

  if (!parts.length) return 0;
  const distance = parts.reduce((sum, part) => sum + part, 0) / parts.length;
  return Math.exp(-distance);
}

function dataQualitySignal(
  observations: SurfObservation[],
  target: {
    time: number;
    delta: number;
    upstream: number;
    level: number | null;
    reichenau: number | null;
  },
): DataQualitySignal {
  const rated = observations
    .filter(isRealObservation)
    .filter((observation) => {
      const features = observationDataFeatures(observation);
      return (
        features.delta !== null ||
        features.upstream !== null ||
        features.level !== null ||
        features.reichenau !== null
      );
    });
  const targetIsNewSetup = target.time >= platformSetupChangeAt;
  const sameSetup = rated.filter((observation) =>
    targetIsNewSetup
      ? observation.observedAt >= platformSetupChangeAt
      : observation.observedAt < platformSetupChangeAt,
  );
  const useSameSetup = sameSetup.length >= 3;
  const basis = useSameSetup ? sameSetup : rated;

  if (!basis.length) {
    return {
      score: null,
      confidence: 0,
      label: "schwach",
      sampleSize: 0,
      sameSetupCount: sameSetup.length,
      matchedCount: 0,
      basis: "keine Daten",
      note: "Noch keine bewerteten Sessiondaten.",
    };
  }

  const weighted = basis
    .map((observation) => ({
      observation,
      similarity: dataSimilarity(target, observationDataFeatures(observation)),
    }))
    .filter((entry) => entry.similarity >= 0.08)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8);
  const relevant = weighted.length ? weighted : basis.map((observation) => ({
    observation,
    similarity: 0.08,
  }));
  const weightSum = relevant.reduce((sum, entry) => sum + entry.similarity, 0);
  const score =
    relevant.reduce(
      (sum, entry) => sum + observationScore(entry.observation.quality) * entry.similarity,
      0,
    ) / Math.max(0.01, weightSum);
  const setupPenalty = targetIsNewSetup && !useSameSetup ? 0.45 : 1;
  const dataAmount = clamp(basis.length / 12, 0, 1);
  const matchStrength = clamp(weightSum / 4, 0, 1);
  const confidence = Math.round(
    clamp((dataAmount * 0.55 + matchStrength * 0.45) * setupPenalty, 0, 1) * 100,
  );
  const label =
    confidence >= 60 ? "brauchbar" : confidence >= 30 ? "vorsichtig" : "schwach";
  const basisLabel: DataQualitySignal["basis"] = useSameSetup
    ? "gleiches Setup"
    : targetIsNewSetup
      ? "altes Setup"
      : "gemischt";

  return {
    score: Math.round(score),
    confidence,
    label,
    sampleSize: basis.length,
    sameSetupCount: sameSetup.length,
    matchedCount: weighted.length,
    basis: basisLabel,
    note:
      basisLabel === "altes Setup"
        ? "Noch zu wenige Bewertungen im neuen Setup. Signal wird gedämpft."
        : "Ähnliche gespeicherte Bewertungen werden gewichtet.",
  };
}

function blendManualQuality(
  modelScore: number,
  signal: ManualQualitySignal | null,
  referenceTime: number,
) {
  if (!signal) return modelScore;
  const ageHours = Math.max(0, referenceTime - signal.observedAt) / (60 * 60 * 1000);
  const weight = ageHours <= 1 ? 0.35 : ageHours <= 3 ? 0.25 : 0.15;
  return Math.round(clamp(modelScore * (1 - weight) + signal.score * weight));
}

function blendDataQuality(
  modelScore: number,
  signal: DataQualitySignal,
) {
  if (signal.score === null || signal.confidence <= 0) return modelScore;
  const weight = Math.min(0.28, signal.confidence / 100 * 0.28);
  return Math.round(clamp(modelScore * (1 - weight) + signal.score * weight));
}

function statusTone(station: HydroStation) {
  const classification = station.water.classification?.toLowerCase() ?? "";
  if (classification.includes("hw30")) return "danger";
  if (classification.includes("hw") || classification.includes(">mw")) return "watch";
  if (classification.includes("niedrig")) return "low";
  return "normal";
}

function valueOrNull(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timeFromStations(stations: HydroStation[]) {
  return (
    stations
      .flatMap((station) => [station.discharge.dt, station.water.dt])
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => b - a)[0] ?? Date.now()
  );
}

function historyPointFromPayload(payload: HydroPayload): HistoryPoint | null {
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

function readStoredHistory() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(historyStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((point) => ({
        t: Number(point.t),
        kroessbach: valueOrNull(point.kroessbach),
        puig: valueOrNull(point.puig),
        reichenau: valueOrNull(point.reichenau),
        kroessbachLevel: valueOrNull(point.kroessbachLevel),
        puigLevel: valueOrNull(point.puigLevel),
        reichenauLevel: valueOrNull(point.reichenauLevel),
      }))
      .filter((point) => Number.isFinite(point.t));
  } catch {
    return [];
  }
}

function compactHistory(points: HistoryPoint[], maxPoints = 5000) {
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

function compactWeatherHistory(points: WeatherPoint[], maxPoints = 50000) {
  const byStationAndTime = new Map<string, WeatherPoint>();

  for (const point of points) {
    if (!Number.isFinite(point.t)) continue;
    const t = Math.round(point.t / (10 * 60 * 1000)) * (10 * 60 * 1000);
    byStationAndTime.set(`${point.stationId}:${t}`, { ...point, t });
  }

  return [...byStationAndTime.values()]
    .sort((a, b) => a.t - b.t || a.stationId.localeCompare(b.stationId))
    .slice(-maxPoints);
}

function rainfallTotals(
  points: WeatherPoint[],
  referenceTime: number,
  windowMs: number,
) {
  const from = referenceTime - windowMs;
  const totals = new Map<string, number>();

  for (const point of points) {
    if (point.rainMm === null || point.t < from || point.t > referenceTime) continue;
    totals.set(point.stationId, (totals.get(point.stationId) ?? 0) + point.rainMm);
  }

  const values = [...totals.values()];
  const areaMean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
  const maxStation = values.length ? Math.max(...values) : 0;

  return {
    areaMean,
    maxStation,
    stationCount: values.length,
  };
}

function aggregateRainSeries(points: WeatherPoint[]) {
  const byTime = new Map<number, number[]>();

  for (const point of points) {
    if (point.rainMm === null) continue;
    const values = byTime.get(point.t) ?? [];
    values.push(point.rainMm);
    byTime.set(point.t, values);
  }

  return [...byTime.entries()]
    .map(([t, values]) => ({
      t,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => a.t - b.t);
}

function weatherStationSeries(points: WeatherPoint[], stationId: string) {
  return points
    .filter((point) => point.stationId === stationId)
    .map((point) => ({ t: point.t, value: point.rainMm }))
    .sort((a, b) => a.t - b.t);
}

function readStoredReviewRange() {
  if (typeof window === "undefined") return defaultReviewRange;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(reviewRangeStorageKey) ?? "{}",
    );
    const preset = reviewPresets.some((item) => item.id === parsed.preset)
      ? (parsed.preset as ReviewPreset)
      : defaultReviewRange.preset;

    return {
      preset,
      fromDate: typeof parsed.fromDate === "string" ? parsed.fromDate : "",
      toDate: typeof parsed.toDate === "string" ? parsed.toDate : "",
    };
  } catch {
    return defaultReviewRange;
  }
}

function readStoredSettings() {
  if (typeof window === "undefined") return defaultForecastSettings;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(settingsStorageKey) ?? "{}",
    );
    return {
      lagKroessbach:
        Number.isFinite(parsed.lagKroessbach) && parsed.lagKroessbach > 0
          ? Number(parsed.lagKroessbach)
          : defaultForecastSettings.lagKroessbach,
      lagPuig:
        Number.isFinite(parsed.lagPuig) && parsed.lagPuig > 0
          ? Number(parsed.lagPuig)
          : defaultForecastSettings.lagPuig,
      waveOffset:
        Number.isFinite(parsed.waveOffset) && parsed.waveOffset >= 0
          ? Number(parsed.waveOffset)
          : defaultForecastSettings.waveOffset,
      surfMin:
        Number.isFinite(parsed.surfMin) && parsed.surfMin >= 0
          ? Number(parsed.surfMin)
          : defaultForecastSettings.surfMin,
      surfMax:
        Number.isFinite(parsed.surfMax) && parsed.surfMax > 0
          ? Number(parsed.surfMax)
          : defaultForecastSettings.surfMax,
      levelMin:
        Number.isFinite(parsed.levelMin) && parsed.levelMin >= 0
          ? Number(parsed.levelMin)
          : defaultForecastSettings.levelMin,
      levelMax:
        Number.isFinite(parsed.levelMax) && parsed.levelMax > 0
          ? Number(parsed.levelMax)
          : defaultForecastSettings.levelMax,
    };
  } catch {
    return defaultForecastSettings;
  }
}

function shiftedForecast(
  history: HistoryPoint[],
  lagKroessbach: number,
  lagPuig: number,
  fallbackTime: number,
) {
  const now = history[history.length - 1]?.t ?? fallbackTime;
  const start = Math.min(history[0]?.t ?? now, now);
  const end = now + 6 * 60 * 60 * 1000;
  const samples = Math.ceil((end - start) / sampleInterval) + 1;

  return Array.from({ length: samples }, (_, index) => {
    const t = start + index * sampleInterval;
    const shifted = shiftedUpstreamAt(history, t, lagKroessbach, lagPuig);

    return { t, value: shifted.value };
  });
}

function reviewRangeToDomain(
  range: ReviewRange,
  history: HistoryPoint[],
  referenceTime: number,
) {
  const newest = history[history.length - 1]?.t ?? referenceTime;
  const oldest = history[0]?.t ?? newest - dayMs;
  const forecastHorizon = 2 * 60 * 60 * 1000;
  const max = Math.max(newest + sampleInterval, newest + forecastHorizon);

  if (range.preset === "12h") {
    return { min: newest - 12 * 60 * 60 * 1000, max };
  }
  if (range.preset === "week") {
    return { min: newest - 7 * dayMs, max };
  }
  if (range.preset === "month") {
    return { min: newest - 30 * dayMs, max };
  }
  if (range.preset === "year") {
    return { min: newest - 365 * dayMs, max };
  }
  if (range.preset === "all") {
    return { min: oldest, max };
  }
  if (range.preset === "custom") {
    const from = parseStartDate(range.fromDate);
    const to = parseEndDate(range.toDate);
    if (from !== null && to !== null) return { min: Math.min(from, to), max: Math.max(from, to) };
    if (from !== null) return { min: from, max: from + dayMs };
    if (to !== null) return { min: to - dayMs, max: to };
  }

  return { min: max - dayMs, max };
}

function reviewRangeHours(range: ReviewRange) {
  if (range.preset === "12h") return 12;
  if (range.preset === "week") return 7 * 24;
  if (range.preset === "month") return 30 * 24;
  if (range.preset === "year") return 365 * 24;
  if (range.preset === "all") return 365 * 24;
  if (range.preset === "custom") {
    const from = parseStartDate(range.fromDate);
    const to = parseEndDate(range.toDate);
    const earliest = from ?? to ?? Date.now() - dayMs;
    return Math.min(
      365 * 24,
      Math.max(24, Math.ceil((Date.now() - earliest) / (60 * 60 * 1000)) + 24),
    );
  }

  return 24;
}

function valueAt(
  points: { t: number; value: number | null }[],
  t: number,
) {
  const valid = points
    .filter((point): point is { t: number; value: number } => point.value !== null)
    .sort((a, b) => a.t - b.t);

  if (!valid.length) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];
  if (t <= first.t) return first.value;
  if (t >= last.t) return last.value;

  for (let index = 1; index < valid.length; index += 1) {
    const previous = valid[index - 1];
    const next = valid[index];
    if (previous.t <= t && next.t >= t) {
      const share = (t - previous.t) / Math.max(1, next.t - previous.t);
      return previous.value + (next.value - previous.value) * share;
    }
  }

  return last.value;
}

function integrateDeltaVolume(
  points: { t: number; value: number | null }[],
  start: number,
  end: number,
) {
  if (end <= start) return null;
  const valid = points
    .filter((point): point is { t: number; value: number } => point.value !== null)
    .sort((a, b) => a.t - b.t);

  if (!valid.length) return null;

  const samples = [
    { t: start, value: valueAt(valid, start) },
    ...valid.filter((point) => point.t > start && point.t < end),
    { t: end, value: valueAt(valid, end) },
  ]
    .filter((point): point is { t: number; value: number } => point.value !== null)
    .sort((a, b) => a.t - b.t);

  if (samples.length < 2) return null;

  return samples.slice(1).reduce((sum, point, index) => {
    const previous = samples[index];
    const seconds = (point.t - previous.t) / 1000;
    return sum + ((previous.value + point.value) / 2) * seconds;
  }, 0);
}

function rollingVolumeBalanceSeries(
  points: { t: number; value: number | null }[],
  windowMs = 60 * 60 * 1000,
) {
  return points
    .filter((point): point is { t: number; value: number } => point.value !== null)
    .sort((a, b) => a.t - b.t)
    .map((point) => ({
      t: point.t,
      value: integrateDeltaVolume(points, point.t - windowMs, point.t),
    }));
}

function volumeBalanceSummary(
  points: { t: number; value: number | null }[],
  referenceTime: number,
) {
  const balance30 = integrateDeltaVolume(
    points,
    referenceTime - 30 * 60 * 1000,
    referenceTime,
  );
  const balance60 = integrateDeltaVolume(
    points,
    referenceTime - 60 * 60 * 1000,
    referenceTime,
  );
  const balance120 = integrateDeltaVolume(
    points,
    referenceTime - 120 * 60 * 1000,
    referenceTime,
  );

  return {
    balance30,
    balance60,
    balance120,
    rolling60: rollingVolumeBalanceSeries(points),
  };
}

function expectedDeltaSeries(
  forecast: { t: number; value: number | null }[],
  history: HistoryPoint[],
  waveOffset: number,
  lagKroessbach: number,
  lagPuig: number,
) {
  const offsetMs = waveOffset * 60 * 1000;
  const maxAgeMs = sampleInterval * 3;

  const measuredDelta = history.map((point) => {
    const upstream = shiftedUpstreamAt(
      history,
      point.t,
      lagKroessbach,
      lagPuig,
      maxAgeMs,
    ).value;

    return {
      t: point.t - offsetMs,
      value:
        point.reichenau === null || upstream === null
          ? null
          : point.reichenau - upstream,
    };
  });

  const latestHistoryTime = history[history.length - 1]?.t ?? Date.now();
  const validMeasured = measuredDelta.filter(
    (point): point is { t: number; value: number } => point.value !== null,
  );
  const recentMeasured = validMeasured
    .filter((point) => point.t >= latestHistoryTime - offsetMs - 2 * 60 * 60 * 1000)
    .slice(-8);
  const projectedValue =
    recentMeasured.length > 0
      ? recentMeasured.reduce((sum, point) => sum + point.value, 0) /
        recentMeasured.length
      : (validMeasured[validMeasured.length - 1]?.value ?? null);

  const projectedDelta = forecast
    .filter((point) => point.t > latestHistoryTime)
    .map((point) => ({
      t: point.t - offsetMs,
      value: point.value === null ? null : projectedValue,
    }));

  return [...measuredDelta, ...projectedDelta].sort((a, b) => a.t - b.t);
}

function latestAtWithAge(
  history: HistoryPoint[],
  t: number,
  key: keyof Omit<HistoryPoint, "t">,
  maxAgeMs: number,
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const point = history[index];
    if (point.t <= t) {
      if (t - point.t > maxAgeMs) return null;
      return point[key];
    }
  }
  return null;
}

function latestAt(
  history: HistoryPoint[],
  t: number,
  key: keyof Omit<HistoryPoint, "t">,
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].t <= t) return history[index][key];
  }
  return null;
}

function shiftedUpstreamAt(
  history: HistoryPoint[],
  t: number,
  lagKroessbach: number,
  lagPuig: number,
  maxAgeMs?: number,
) {
  const krTime = t - lagKroessbach * 60 * 1000;
  const puigTime = t - lagPuig * 60 * 1000;
  const kroessbach =
    maxAgeMs === undefined
      ? latestAt(history, krTime, "kroessbach")
      : latestAtWithAge(history, krTime, "kroessbach", maxAgeMs);
  const puig =
    maxAgeMs === undefined
      ? latestAt(history, puigTime, "puig")
      : latestAtWithAge(history, puigTime, "puig", maxAgeMs);

  return {
    kroessbach,
    puig,
    value:
      kroessbach === null && puig === null ? null : (kroessbach ?? 0) + (puig ?? 0),
  };
}

function inflowTrendAt(
  history: HistoryPoint[],
  t: number,
  lagKroessbach = 0,
  lagPuig = 0,
): InflowTrend {
  const maxAgeMs = sampleInterval * 3;
  const current = shiftedUpstreamAt(
    history,
    t,
    lagKroessbach,
    lagPuig,
    maxAgeMs,
  ).value;
  const before30 = shiftedUpstreamAt(
    history,
    t - 30 * 60 * 1000,
    lagKroessbach,
    lagPuig,
    maxAgeMs,
  ).value;
  const before60 = shiftedUpstreamAt(
    history,
    t - 60 * 60 * 1000,
    lagKroessbach,
    lagPuig,
    maxAgeMs,
  ).value;
  const delta30 = current !== null && before30 !== null ? current - before30 : null;
  const delta60 = current !== null && before60 !== null ? current - before60 : null;
  const label = inflowTrendLabel(delta60);

  return {
    current,
    before30,
    before60,
    delta30,
    delta60,
    label,
    tone: inflowTrendTone(label),
  };
}

function pearsonCorrelation(pairs: { x: number; y: number }[]) {
  if (pairs.length < 3) return null;
  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;
  const parts = pairs.reduce(
    (acc, pair) => {
      const dx = pair.x - meanX;
      const dy = pair.y - meanY;
      return {
        numerator: acc.numerator + dx * dy,
        xSquares: acc.xSquares + dx * dx,
        ySquares: acc.ySquares + dy * dy,
      };
    },
    { numerator: 0, xSquares: 0, ySquares: 0 },
  );
  const denominator = Math.sqrt(parts.xSquares * parts.ySquares);
  if (denominator === 0) return null;
  return parts.numerator / denominator;
}

function runtimeComparisonSummary(
  history: HistoryPoint[],
  settings: ForecastSettings,
  timeDomain: TimeDomain,
): RuntimeComparisonSummary {
  const maxAgeMs = sampleInterval * 3;
  const points = history
    .filter(
      (point) =>
        point.t >= timeDomain.min &&
        point.t <= timeDomain.max &&
        point.reichenau !== null,
    )
    .map((point) => {
      const shifted = shiftedUpstreamAt(
        history,
        point.t,
        settings.lagKroessbach,
        settings.lagPuig,
        maxAgeMs,
      );
      if (shifted.value === null) return null;
      return {
        t: point.t,
        expected: shifted.value,
        measured: point.reichenau ?? 0,
        delta: (point.reichenau ?? 0) - shifted.value,
        kroessbach: shifted.kroessbach,
        puig: shifted.puig,
      };
    })
    .filter((point): point is RuntimeComparisonPoint => point !== null);

  if (!points.length) {
    return {
      count: 0,
      correlation: null,
      kroessbachCorrelation: null,
      puigCorrelation: null,
      meanDelta: null,
      meanAbsoluteDelta: null,
      latest: null,
    };
  }

  const meanDelta =
    points.reduce((sum, point) => sum + point.delta, 0) / points.length;
  const meanAbsoluteDelta =
    points.reduce((sum, point) => sum + Math.abs(point.delta), 0) / points.length;

  return {
    count: points.length,
    correlation: pearsonCorrelation(
      points.map((point) => ({ x: point.expected, y: point.measured })),
    ),
    kroessbachCorrelation: pearsonCorrelation(
      points
        .filter((point) => point.kroessbach !== null)
        .map((point) => ({ x: point.kroessbach ?? 0, y: point.measured })),
    ),
    puigCorrelation: pearsonCorrelation(
      points
        .filter((point) => point.puig !== null)
        .map((point) => ({ x: point.puig ?? 0, y: point.measured })),
    ),
    meanDelta,
    meanAbsoluteDelta,
    latest: points[points.length - 1],
  };
}

export default function Home() {
  const [payload, setPayload] = useState<HydroPayload>(fallbackPayload);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStation, setSelectedStation] = useState("202283");
  const [chartType, setChartType] = useState<"W" | "Q">("W");
  const [nowMs] = useState(() => Date.now());
  const [history, setHistory] = useState<HistoryPoint[]>(() => readStoredHistory());
  const [weatherPayload, setWeatherPayload] =
    useState<WeatherPayload>(defaultWeatherPayload);
  const [weatherError, setWeatherError] = useState("");
  const [forecastSettings, setForecastSettings] = useState<ForecastSettings>(() =>
    readStoredSettings(),
  );
  const [reviewRange, setReviewRange] = useState<ReviewRange>(() =>
    readStoredReviewRange(),
  );
  const [timeZoom, setTimeZoom] = useState<TimeZoom>(defaultTimeZoom);
  const [timeDrag, setTimeDrag] = useState<TimeDrag | null>(null);
  const [chartHover, setChartHover] = useState(false);
  const chartNavigatorRef = useRef<HTMLDivElement | null>(null);
  const chartInteractionRef = useRef({
    canMoveTimeAxis: false,
    hasZoomableTimeAxis: false,
    timeZoom: defaultTimeZoom,
  });
  const [observations, setObservations] = useState<SurfObservation[]>([]);
  const [observationForm, setObservationForm] = useState(() => ({
    observedAt: formatDateTimeInput(Date.now()),
    trimCm: "",
    quality: 3.0,
    note: "",
  }));
  const [editingObservationId, setEditingObservationId] = useState<number | null>(
    null,
  );
  const [observationSaving, setObservationSaving] = useState(false);
  const [deletingObservationId, setDeletingObservationId] = useState<number | null>(
    null,
  );
  const [observationMessage, setObservationMessage] = useState("");
  const [setupLogs, setSetupLogs] = useState<PlatformSetupLog[]>([]);
  const [setupForm, setSetupForm] = useState(() => emptySetupForm());
  const [editingSetupId, setEditingSetupId] = useState<number | null>(null);
  const [setupSaving, setSetupSaving] = useState(false);
  const [deletingSetupId, setDeletingSetupId] = useState<number | null>(null);
  const [setupMessage, setSetupMessage] = useState("");

  function recordHistory(nextPayload: HydroPayload) {
    const point = historyPointFromPayload(nextPayload);
    if (!point) return;

    setHistory((current) => {
      const next = compactHistory([...current, point]);
      window.localStorage.setItem(historyStorageKey, JSON.stringify(next));
      return next;
    });
  }

  async function refresh(historyHours = reviewRangeHours(reviewRange)) {
    setLoading(true);
    setError("");
    try {
      const runtimeBufferHours =
        Math.ceil(
          Math.max(forecastSettings.lagKroessbach, forecastSettings.lagPuig) / 60,
        ) + 1;
      const fetchHours = Math.min(365 * 24, historyHours + runtimeBufferHours);
      const response = await fetch(
        `/api/hydro?hours=${Math.ceil(fetchHours)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Daten konnten nicht geladen werden");
      const nextPayload = (await response.json()) as HydroPayload;
      const orderedPayload = {
        ...nextPayload,
        stations: stationOrder
          .map((id) => nextPayload.stations.find((station) => station.id === id))
          .filter(Boolean) as HydroStation[],
      };
      setPayload(orderedPayload);
      const currentPoint = historyPointFromPayload(orderedPayload);
      if (orderedPayload.history?.length) {
        const nextHistory = compactHistory(
          [...orderedPayload.history, currentPoint].filter(Boolean) as HistoryPoint[],
        );
        setHistory(nextHistory);
        window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      } else {
        recordHistory(orderedPayload);
      }
      void refreshWeather(historyHours);
      void refreshObservations(historyHours);
      void refreshSetupLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function refreshObservations(historyHours = reviewRangeHours(reviewRange)) {
    try {
      const response = await fetch(
        `/api/surf-observations?hours=${Math.ceil(Math.max(72, historyHours))}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Beobachtungen nicht verfügbar");
      const data = (await response.json()) as {
        observations?: SurfObservation[];
      };
      setObservations(sortSurfObservations(data.observations ?? []));
    } catch {
      setObservations([]);
    }
  }

  async function refreshWeather(historyHours = reviewRangeHours(reviewRange)) {
    setWeatherError("");
    try {
      const response = await fetch(
        `/api/weather?hours=${Math.ceil(Math.max(24, historyHours))}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as WeatherPayload;
      if (!response.ok) throw new Error(data.error ?? "Wetterdaten nicht verfügbar");
      setWeatherPayload({
        ...defaultWeatherPayload,
        ...data,
        stations: data.stations?.length ? data.stations : defaultWeatherPayload.stations,
        history: compactWeatherHistory(data.history ?? []),
      });
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : "Wetterdaten nicht verfügbar");
    }
  }

  async function refreshSetupLogs() {
    try {
      const response = await fetch("/api/platform-setup?limit=80", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Setup-Logs nicht verfügbar");
      const data = (await response.json()) as { logs?: PlatformSetupLog[] };
      setSetupLogs(sortSetupLogs(data.logs ?? []));
    } catch {
      setSetupLogs([]);
    }
  }

  async function submitSetupLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupMessage("");

    const loggedAt = parseDateTimeInput(setupForm.loggedAt);

    if (loggedAt === null) {
      setSetupMessage("Bitte Datum und Uhrzeit eintragen.");
      return;
    }

    setSetupSaving(true);
    try {
      const isEditing = editingSetupId !== null;
      const response = await fetch("/api/platform-setup", {
        method: isEditing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingSetupId,
          loggedAt,
          waveMaster: setupForm.waveMaster,
          chainLeftCm: setupForm.chainLeftCm,
          chainRightCm: setupForm.chainRightCm,
          rampPosition: setupForm.rampPosition,
          trimHeightCm: setupForm.trimHeightCm,
          tensionLeft: setupForm.tensionLeft,
          tensionRight: setupForm.tensionRight,
          waterLevelCm: setupForm.waterLevelCm,
          dischargeCms: setupForm.dischargeCms,
          note: setupForm.note,
        }),
      });
      const data = (await response.json()) as {
        log?: PlatformSetupLog;
        error?: string;
      };
      if (!response.ok || !data.log) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen");
      }
      setSetupLogs((current) => {
        const withoutOldVersion = current.filter((log) => log.id !== data.log!.id);
        return sortSetupLogs([data.log!, ...withoutOldVersion]).slice(0, 80);
      });
      setEditingSetupId(null);
      setSetupForm(emptySetupForm(setupForm.loggedAt));
      setSetupMessage(
        isEditing
          ? "Setup-Wert aktualisiert. Pegel/Abfluss wurden neu aus Reichenau zugeordnet."
          : "Setup-Wert gespeichert. Pegel/Abfluss wurden aus Reichenau übernommen.",
      );
    } catch (err) {
      setSetupMessage(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setSetupSaving(false);
    }
  }

  async function deleteSetupLog(id: number) {
    if (!window.confirm("Diesen Setup-Wert wirklich löschen?")) return;

    setSetupMessage("");
    setDeletingSetupId(id);
    try {
      const response = await fetch(`/api/platform-setup?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Löschen fehlgeschlagen");
      }
      setSetupLogs((current) => current.filter((log) => log.id !== id));
      if (editingSetupId === id) {
        cancelSetupEdit();
      }
      setSetupMessage("Setup-Wert gelöscht.");
    } catch (err) {
      setSetupMessage(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingSetupId(null);
    }
  }

  function editSetupLog(log: PlatformSetupLog) {
    setEditingSetupId(log.id);
    setSetupForm(setupFormFromLog(log));
    setSetupMessage("Setup-Wert wird bearbeitet.");
  }

  function cancelSetupEdit() {
    setEditingSetupId(null);
    setSetupForm(emptySetupForm());
    setSetupMessage("");
  }

  async function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setObservationMessage("");

    const trimCm = Number(observationForm.trimCm);
    const observedAt = parseDateTimeInput(observationForm.observedAt);

    if (observedAt === null) {
      setObservationMessage("Bitte Zeitpunkt eintragen.");
      return;
    }

    if (!Number.isFinite(trimCm) || trimCm < 0) {
      setObservationMessage("Bitte Trim als cm-Wert eintragen.");
      return;
    }

    setObservationSaving(true);
    try {
      const isEditing = editingObservationId !== null;
      const response = await fetch("/api/surf-observations", {
        method: isEditing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingObservationId,
          observedAt,
          trimCm,
          quality: observationForm.quality,
          note: observationForm.note,
        }),
      });
      const data = (await response.json()) as {
        observation?: SurfObservation;
        error?: string;
      };
      if (!response.ok || !data.observation) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen");
      }
      setObservations((current) => {
        const withoutOldVersion = current.filter(
          (observation) => observation.id !== data.observation!.id,
        );
        return sortSurfObservations([data.observation!, ...withoutOldVersion]).slice(
          0,
          200,
        );
      });
      setEditingObservationId(null);
      setObservationForm((current) => ({
        ...current,
        observedAt: formatDateTimeInput(observedAt + 30 * 60 * 1000),
        trimCm: "",
        note: "",
      }));
      setObservationMessage(isEditing ? "Eintrag aktualisiert." : "Gespeichert.");
    } catch (err) {
      setObservationMessage(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setObservationSaving(false);
    }
  }

  function editObservation(observation: SurfObservation) {
    setEditingObservationId(observation.id);
    setObservationForm({
      observedAt: formatDateTimeInput(observation.observedAt),
      trimCm:
        observation.trimCm === null
          ? ""
          : String(Math.round(observation.trimCm * 10) / 10),
      quality: observation.quality,
      note: observation.note ?? "",
    });
    setObservationMessage("Eintrag wird bearbeitet.");
  }

  function cancelObservationEdit() {
    setEditingObservationId(null);
    setObservationForm({
      observedAt: formatDateTimeInput(Date.now()),
      trimCm: "",
      quality: 3.0,
      note: "",
    });
    setObservationMessage("");
  }

  async function deleteObservation(id: number) {
    if (!window.confirm("Diesen Sessionwert wirklich löschen?")) return;

    setObservationMessage("");
    setDeletingObservationId(id);
    try {
      const response = await fetch(`/api/surf-observations?id=${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Löschen fehlgeschlagen");
      }
      setObservations((current) =>
        current.filter((observation) => observation.id !== id),
      );
      if (editingObservationId === id) {
        cancelObservationEdit();
      }
      setObservationMessage("Eintrag gelöscht.");
    } catch (err) {
      setObservationMessage(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen",
      );
    } finally {
      setDeletingObservationId(null);
    }
  }

  useEffect(() => {
    const historyHours = reviewRangeHours(reviewRange);
    const runRefresh = () => {
      void refresh(historyHours);
    };
    const startup = window.setTimeout(runRefresh, 0);
    const timer = window.setInterval(runRefresh, sampleInterval);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reviewRange.preset,
    reviewRange.fromDate,
    reviewRange.toDate,
    forecastSettings.lagKroessbach,
    forecastSettings.lagPuig,
  ]);

  const stationsById = useMemo(
    () => Object.fromEntries(payload.stations.map((station) => [station.id, station])),
    [payload.stations],
  );

  const kr = stationsById["202283"];
  const puig = stationsById["201574"];
  const reichenau = stationsById["201624"];

  useEffect(() => {
    window.localStorage.setItem(
      settingsStorageKey,
      JSON.stringify(forecastSettings),
    );
  }, [forecastSettings]);

  useEffect(() => {
    window.localStorage.setItem(
      reviewRangeStorageKey,
      JSON.stringify(reviewRange),
    );
  }, [reviewRange]);

  const upstreamFlow =
    (kr?.discharge.value ?? 0) + (puig?.discharge.value ?? 0);
  const downstreamFlow = reichenau?.discharge.value ?? 0;
  const ratio = upstreamFlow > 0 ? (downstreamFlow / upstreamFlow) * 100 : 0;
  const selected = stationsById[selectedStation] ?? payload.stations[0];
  const mostRecent = payload.stations
    .map((station) => station.water.dt)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  const forecastHistory = history.length
    ? history
    : compactHistory([historyPointFromPayload(payload)].filter(Boolean) as HistoryPoint[]);
  const newestHistoryPoint = forecastHistory[forecastHistory.length - 1]?.t;
  const forecastLine = shiftedForecast(
    forecastHistory,
    forecastSettings.lagKroessbach,
    forecastSettings.lagPuig,
    nowMs,
  );
  const deltaLine = expectedDeltaSeries(
    forecastLine,
    forecastHistory,
    forecastSettings.waveOffset,
    forecastSettings.lagKroessbach,
    forecastSettings.lagPuig,
  );
  const waveTime = mostRecent ?? forecastHistory[forecastHistory.length - 1]?.t ?? nowMs;
  const lastMeasurementTime = newestHistoryPoint ?? waveTime;
  const baseTimeDomain = reviewRangeToDomain(
    reviewRange,
    forecastHistory,
    Math.max(
      forecastLine[forecastLine.length - 1]?.t ?? lastMeasurementTime,
      lastMeasurementTime + sampleInterval,
    ),
  );
  const chartTimeDomain = zoomTimeDomain(baseTimeDomain, timeZoom);
  const baseTimeSpan = baseTimeDomain.max - baseTimeDomain.min;
  const chartTimeSpan = chartTimeDomain.max - chartTimeDomain.min;
  const hasZoomableTimeAxis = baseTimeSpan > 90 * 60 * 1000;
  const canMoveTimeAxis = chartTimeSpan < baseTimeSpan - sampleInterval;
  const visibleHistoryPoints = forecastHistory.filter(
    (point) => point.t >= chartTimeDomain.min && point.t <= chartTimeDomain.max,
  );
  const waveLagKroessbach = Math.max(
    0,
    forecastSettings.lagKroessbach - forecastSettings.waveOffset,
  );
  const waveLagPuig = Math.max(
    0,
    forecastSettings.lagPuig - forecastSettings.waveOffset,
  );
  const reichenauEquivalentTime = waveTime + forecastSettings.waveOffset * 60 * 1000;
  const upstreamAtWave =
    shiftedUpstreamAt(
      forecastHistory,
      waveTime,
      waveLagKroessbach,
      waveLagPuig,
    ).value ?? upstreamFlow;
  const expectedWaveDelta =
    valueAt(deltaLine, waveTime) ?? downstreamFlow - upstreamFlow;
  const volumeBalance = volumeBalanceSummary(deltaLine, waveTime);
  const visibleWeatherPoints = weatherPayload.history.filter(
    (point) => point.t >= chartTimeDomain.min && point.t <= chartTimeDomain.max,
  );
  const rain1h = rainfallTotals(weatherPayload.history, waveTime, 60 * 60 * 1000);
  const rain3h = rainfallTotals(weatherPayload.history, waveTime, 3 * 60 * 60 * 1000);
  const rain6h = rainfallTotals(weatherPayload.history, waveTime, 6 * 60 * 60 * 1000);
  const rain12h = rainfallTotals(weatherPayload.history, waveTime, 12 * 60 * 60 * 1000);
  const currentInflowTrend = inflowTrendAt(forecastHistory, waveTime);
  const waveInflowTrend = inflowTrendAt(
    forecastHistory,
    waveTime,
    waveLagKroessbach,
    waveLagPuig,
  );
  const levelAtWave =
    latestAt(forecastHistory, waveTime, "reichenauLevel") ??
    valueOrNull(reichenau?.water.value);
  const qualityNowModelScore = waveQualityScore(
    expectedWaveDelta,
    upstreamAtWave,
    levelAtWave,
    forecastSettings.surfMin,
    forecastSettings.surfMax,
    forecastSettings.levelMin,
    forecastSettings.levelMax,
    volumeBalance.balance60,
  );
  const manualNow = recentManualSignal(observations, waveTime);
  const dataNow = dataQualitySignal(observations, {
    time: waveTime,
    delta: expectedWaveDelta,
    upstream: upstreamAtWave,
    level: levelAtWave,
    reichenau: downstreamFlow,
  });
  const qualityNowDataScore = blendDataQuality(qualityNowModelScore, dataNow);
  const qualityNow: WaveQualityProjection = {
    time: waveTime,
    delta: expectedWaveDelta,
    upstream: upstreamAtWave,
    trend: waveInflowTrend,
    level: levelAtWave,
    volumeBalance60: volumeBalance.balance60,
    modelScore: qualityNowModelScore,
    data: dataNow,
    dataScore: qualityNowDataScore,
    manual: manualNow,
    score: blendManualQuality(qualityNowDataScore, manualNow, waveTime),
  };
  const horizonEnd = waveTime + 2 * 60 * 60 * 1000;
  const qualityCandidates = deltaLine
    .filter(
      (point): point is { t: number; value: number } =>
        point.value !== null && point.t >= waveTime && point.t <= horizonEnd,
    )
    .map((point) => {
      const upstream =
        shiftedUpstreamAt(
          forecastHistory,
          point.t,
          waveLagKroessbach,
          waveLagPuig,
        ).value ??
        valueAt(forecastLine, point.t + forecastSettings.waveOffset * 60 * 1000) ??
        upstreamAtWave;
      const trend = inflowTrendAt(
        forecastHistory,
        point.t,
        waveLagKroessbach,
        waveLagPuig,
      );
      const level = latestAt(forecastHistory, point.t, "reichenauLevel") ?? levelAtWave;
      const candidateVolumeBalance60 = integrateDeltaVolume(
        deltaLine,
        point.t - 60 * 60 * 1000,
        point.t,
      );
      const modelScore = waveQualityScore(
        point.value,
        upstream,
        level,
        forecastSettings.surfMin,
        forecastSettings.surfMax,
        forecastSettings.levelMin,
        forecastSettings.levelMax,
        candidateVolumeBalance60,
      );
      const manual = recentManualSignal(observations, point.t);
      const data = dataQualitySignal(observations, {
        time: point.t,
        delta: point.value,
        upstream,
        level,
        reichenau: upstream + point.value,
      });
      const dataScore = blendDataQuality(modelScore, data);
      return {
        time: point.t,
        delta: point.value,
        upstream,
        trend,
        level,
        volumeBalance60: candidateVolumeBalance60,
        modelScore,
        data,
        dataScore,
        manual,
        score: blendManualQuality(dataScore, manual, point.t),
      };
    });
  const qualityTimeline = [...qualityCandidates, qualityNow]
    .sort((a, b) => a.time - b.time)
    .filter(
      (point, index, points) =>
        index === 0 || Math.abs(point.time - points[index - 1].time) > 60 * 1000,
    );
  const observationsWithUpstream = observations.filter(
    (observation) =>
      observation.kroessbachDischarge !== null ||
      observation.puigDischarge !== null,
  ).length;
  const runtimeComparison = runtimeComparisonSummary(
    forecastHistory,
    forecastSettings,
    chartTimeDomain,
  );
  const forecastArrivalKroessbach =
    (kr?.discharge.dt ?? mostRecent ?? nowMs) +
    forecastSettings.lagKroessbach * 60 * 1000;
  const forecastArrivalPuig =
    (puig?.discharge.dt ?? mostRecent ?? nowMs) +
    forecastSettings.lagPuig * 60 * 1000;
  const latestForecast =
    forecastLine.findLast((point) => point.value !== null)?.value ?? upstreamFlow;
  useEffect(() => {
    chartInteractionRef.current = {
      canMoveTimeAxis,
      hasZoomableTimeAxis,
      timeZoom,
    };
  }, [canMoveTimeAxis, hasZoomableTimeAxis, timeZoom]);

  useEffect(() => {
    if (!chartHover) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [chartHover]);

  useEffect(() => {
    const node = chartNavigatorRef.current;
    if (!node) return undefined;

    let touchGesture:
      | {
          mode: "pan";
          startX: number;
          startPosition: number;
        }
      | {
          mode: "pinch";
          startDistance: number;
          startDetail: number;
        }
      | null = null;

    const touchDistance = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };

    const handleNativeWheel = (event: WheelEvent) => {
      const interaction = chartInteractionRef.current;
      if (isInteractiveTarget(event.target)) return;
      if (!interaction.hasZoomableTimeAxis) return;

      event.preventDefault();
      event.stopPropagation();

      const deltaX = event.deltaX + (event.shiftKey ? event.deltaY : 0);
      const horizontalScroll = Math.abs(deltaX) > Math.abs(event.deltaY);

      if (horizontalScroll && interaction.canMoveTimeAxis) {
        setTimeZoom((current) => ({
          ...current,
          position: clamp(current.position + deltaX * 0.08, 0, 100),
        }));
        return;
      }

      setTimeZoom((current) => ({
        ...current,
        detail: clamp(current.detail - event.deltaY * 0.08, 0, 100),
      }));
    };

    const handleTouchStart = (event: TouchEvent) => {
      const interaction = chartInteractionRef.current;
      if (isInteractiveTarget(event.target)) return;
      if (!interaction.hasZoomableTimeAxis) return;

      if (event.touches.length >= 2) {
        event.preventDefault();
        touchGesture = {
          mode: "pinch",
          startDistance: Math.max(1, touchDistance(event.touches)),
          startDetail: interaction.timeZoom.detail,
        };
        return;
      }

      if (event.touches.length === 1 && interaction.canMoveTimeAxis) {
        touchGesture = {
          mode: "pan",
          startX: event.touches[0].clientX,
          startPosition: interaction.timeZoom.position,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const interaction = chartInteractionRef.current;
      if (!interaction.hasZoomableTimeAxis || !touchGesture) return;

      if (event.touches.length >= 2 && touchGesture.mode === "pinch") {
        event.preventDefault();
        event.stopPropagation();
        const ratio = touchDistance(event.touches) / touchGesture.startDistance;
        setTimeZoom((current) => ({
          ...current,
          detail: clamp(touchGesture.startDetail + Math.log(ratio) * 48, 0, 100),
        }));
        return;
      }

      if (event.touches.length === 1 && touchGesture.mode === "pan") {
        if (!interaction.canMoveTimeAxis) return;
        event.preventDefault();
        event.stopPropagation();
        const width = Math.max(1, node.clientWidth);
        const deltaPercent =
          ((touchGesture.startX - event.touches[0].clientX) / width) * 100;

        setTimeZoom((current) => ({
          ...current,
          position: clamp(touchGesture.startPosition + deltaPercent, 0, 100),
        }));
      }
    };

    const clearTouchGesture = () => {
      touchGesture = null;
    };

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    node.addEventListener("touchstart", handleTouchStart, { passive: false });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    node.addEventListener("touchend", clearTouchGesture, { passive: false });
    node.addEventListener("touchcancel", clearTouchGesture, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleNativeWheel);
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      node.removeEventListener("touchend", clearTouchGesture);
      node.removeEventListener("touchcancel", clearTouchGesture);
    };
  }, []);

  const handleChartPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (isInteractiveTarget(event.target)) return;
    if (!hasZoomableTimeAxis) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startedFromOverview = !canMoveTimeAxis;
    const position = startedFromOverview ? 50 : timeZoom.position;
    if (startedFromOverview) {
      setTimeZoom((current) => ({
        ...current,
        detail: Math.max(current.detail, 55),
        position,
      }));
    }
    setTimeDrag({ x: event.clientX, position });
  };
  const handleChartPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!timeDrag) return;
    const width = Math.max(1, event.currentTarget.clientWidth);
    const deltaPercent = ((timeDrag.x - event.clientX) / width) * 100;

    if (!canMoveTimeAxis) {
      setTimeZoom((current) => ({
        ...current,
        detail: Math.max(current.detail, 55),
        position: clamp(timeDrag.position + deltaPercent, 0, 100),
      }));
      return;
    }

    setTimeZoom((current) => ({
      ...current,
      position: clamp(timeDrag.position + deltaPercent, 0, 100),
    }));
  };
  const stopChartDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTimeDrag(null);
  };

  return (
    <main className="dashboard-shell">
      <section className="top-band">
        <div>
          <div className="brand-lockup">
            <img src="/surfinn-logo.png" alt="SurfInn" />
            <h1>
              <span>SILLVIA</span>
              <span>Forecast</span>
            </h1>
          </div>
        </div>
        <div className="refresh-panel">
          <span>{loading ? "Aktualisiere" : "Stand"}</span>
          <strong>{formatDate(mostRecent ?? payload.fetchedAt)}</strong>
          <button type="button" onClick={refresh} aria-label="Daten aktualisieren">
            ↻
          </button>
        </div>
      </section>

      {error ? <div className="notice">Liveabruf nicht verfügbar: {error}</div> : null}

      <section className="quality-section">
        <div className="section-heading quality-heading">
          <div>
            <p>
              Wellenqualität <span className="beta-badge">BETA</span>
            </p>
          </div>
          <div className="quality-basis">
            <span>Modell</span>
            <strong>Delta + Volumenbilanz + Oberlieger + Pegel + Meister</strong>
          </div>
        </div>
        <div className="quality-grid">
          <WaveQualityCard title="Jetzt" quality={qualityNow} />
          <WaveQualityScale projections={qualityTimeline} />
        </div>
        <DataQualityBox signal={qualityNow.data} />
      </section>

      <SpotInsightSection observationsWithUpstream={observationsWithUpstream} />

      <section className="forecast-section">
        <div className="section-heading forecast-heading">
          <div>
            <p>Surfforecast</p>
            <h2>Abfluss im Zeitverlauf</h2>
          </div>
          <div className="forecast-status">
            <span>{forecastHistory.length} Punkte</span>
            <strong>{formatNumber(latestForecast, 2)} m³/s</strong>
          </div>
        </div>

        <div className="forecast-layout">
          <div className="forecast-main">
            <ChartTimeControl
              range={reviewRange}
              historyCount={visibleHistoryPoints.length}
              totalHistoryCount={forecastHistory.length}
              fromLabel={formatDate(chartTimeDomain.min)}
              toLabel={formatDate(chartTimeDomain.max)}
              onChange={(nextRange) => {
                setReviewRange(nextRange);
                setTimeZoom({
                  ...defaultTimeZoom,
                  position: nextRange.preset === "custom" ? 0 : 100,
                });
              }}
            />
            <div
              className={`chart-navigator ${timeDrag ? "dragging" : ""}`}
              ref={chartNavigatorRef}
              onMouseEnter={() => setChartHover(true)}
              onMouseLeave={() => setChartHover(false)}
              onPointerDown={handleChartPointerDown}
              onPointerMove={handleChartPointerMove}
              onPointerUp={stopChartDrag}
              onPointerCancel={stopChartDrag}
              onPointerLeave={stopChartDrag}
            >
              <div className="forecast-stack">
                <SurfForecastChart
                  history={forecastHistory}
                  forecast={forecastLine}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  surfMin={Math.min(forecastSettings.surfMin, forecastSettings.surfMax)}
                  surfMax={Math.max(forecastSettings.surfMin, forecastSettings.surfMax)}
                  observations={observations}
                />
                <SurfDeltaChart
                  delta={deltaLine}
                  timeDomain={chartTimeDomain}
                  markerTime={waveTime}
                />
                <SurfVolumeBalanceChart
                  balance={volumeBalance.rolling60}
                  timeDomain={chartTimeDomain}
                  markerTime={waveTime}
                  balance30={volumeBalance.balance30}
                  balance60={volumeBalance.balance60}
                  balance120={volumeBalance.balance120}
                />
                <RainfallSection
                  weather={weatherPayload}
                  visiblePoints={visibleWeatherPoints}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  rain1h={rain1h}
                  rain3h={rain3h}
                  rain6h={rain6h}
                  rain12h={rain12h}
                  error={weatherError}
                />
                <SurfLevelChart
                  history={forecastHistory}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  levelMin={Math.min(forecastSettings.levelMin, forecastSettings.levelMax)}
                  levelMax={Math.max(forecastSettings.levelMin, forecastSettings.levelMax)}
                />
              </div>
            </div>

            <section className="observation-section">
              <div className="section-heading observation-heading">
                <div>
                  <p>Wellenmeister</p>
                  <h2>Sessionwerte eintragen</h2>
                </div>
                <div className="observation-count">
                  <span>72 h Einträge</span>
                  <strong>{observations.length}</strong>
                </div>
              </div>

              <form className="observation-form" onSubmit={submitObservation}>
                <label>
                  <span>Zeitpunkt</span>
                  <input
                    type="datetime-local"
                    required
                    value={observationForm.observedAt}
                    onChange={(event) =>
                      setObservationForm((current) => ({
                        ...current,
                        observedAt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Trim cm</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={observationForm.trimCm}
                    onChange={(event) =>
                      setObservationForm((current) => ({
                        ...current,
                        trimCm: event.target.value,
                      }))
                    }
                    placeholder="niedriger = stärker"
                  />
                </label>
                <fieldset>
                  <legend>Welle</legend>
                  <div className="rating-slider">
                    <strong>{formatQuality(observationForm.quality)}</strong>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.1"
                      value={observationForm.quality}
                      aria-label="Wellenqualität von 1,0 bis 5,0"
                      onChange={(event) =>
                        setObservationForm((current) => ({
                          ...current,
                          quality: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="rating-scale">
                    <span>1,0 schlecht</span>
                    <span>5,0 gut</span>
                  </div>
                </fieldset>
                <label>
                  <span>Notiz</span>
                  <input
                    type="text"
                    value={observationForm.note}
                    onChange={(event) =>
                      setObservationForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="optional"
                  />
                </label>
                <button type="submit" disabled={observationSaving}>
                  {observationSaving
                    ? "Speichert"
                    : editingObservationId === null
                      ? "Speichern"
                      : "Aktualisieren"}
                </button>
                {editingObservationId !== null ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={cancelObservationEdit}
                    disabled={observationSaving}
                  >
                    Abbrechen
                  </button>
                ) : null}
              </form>

              {observationMessage ? (
                <p className="observation-message">{observationMessage}</p>
              ) : null}

              <details className="dashboard-disclosure observation-values-disclosure">
                <summary>
                  <span>Gespeicherte Wellenmeisterwerte</span>
                  <strong>{observations.length} Einträge</strong>
                </summary>
                <div className="observation-list" aria-label="Alle Sessionwerte">
                  {observations.map((observation) => (
                    <article key={observation.id}>
                      <div className="observation-card-head">
                        <span>{formatDate(observation.observedAt)}</span>
                        <div className="observation-card-actions">
                          <button
                            type="button"
                            className="edit"
                            onClick={() => editObservation(observation)}
                            disabled={observationSaving}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteObservation(observation.id)}
                            disabled={deletingObservationId === observation.id}
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      <strong className={`quality-chip ${ratingClass(observation.quality)}`}>
                        {formatQuality(observation.quality)}/5
                      </strong>
                      <p>{formatTrimCm(observation.trimCm, observation.trim)}</p>
                      <dl>
                        <div>
                          <dt>Abfluss K/P/R</dt>
                          <dd>
                            {formatTriple(
                              observation.kroessbachDischarge,
                              observation.puigDischarge,
                              observation.reichenauDischarge,
                              2,
                            )}{" "}
                            m³/s
                          </dd>
                        </div>
                        <div>
                          <dt>Pegel K/P/R</dt>
                          <dd>
                            {formatTriple(
                              observation.kroessbachLevel,
                              observation.puigLevel,
                              observation.reichenauLevel,
                              1,
                            )}{" "}
                            cm
                          </dd>
                        </div>
                      </dl>
                      {observation.note ? <small>{observation.note}</small> : null}
                    </article>
                  ))}
                  {!observations.length ? (
                    <article>
                      <span>Noch keine Einträge</span>
                      <strong>n/a</strong>
                      <p>Die nächsten Sessionwerte erscheinen hier.</p>
                    </article>
                  ) : null}
                </div>
              </details>
            </section>
          </div>

          <aside className="forecast-controls" aria-label="Forecast Einstellungen">
            <RuntimeControl
              label="Krössbach → Reichenau"
              hint="Laufzeit, bis die Hochwasserwelle aus Krössbach in Reichenau ankommt."
              beta
              value={forecastSettings.lagKroessbach}
              min={60}
              max={180}
              onChange={(lagKroessbach) =>
                setForecastSettings((settings) => ({
                  ...settings,
                  lagKroessbach,
                }))
              }
            />
            <RuntimeControl
              label="Puig → Reichenau"
              hint="Laufzeit, bis die Hochwasserwelle aus Puig in Reichenau ankommt."
              beta
              value={forecastSettings.lagPuig}
              min={45}
              max={150}
              onChange={(lagPuig) =>
                setForecastSettings((settings) => ({
                  ...settings,
                  lagPuig,
                }))
              }
            />
            <RuntimeControl
              label="Welle → Reichenau"
              value={forecastSettings.waveOffset}
              min={0}
              max={30}
              onChange={(waveOffset) =>
                setForecastSettings((settings) => ({
                  ...settings,
                  waveOffset,
                }))
              }
            />
            <div className="surf-window">
              <span>Zielbereich</span>
              <div>
                <input
                  aria-label="Unterer Zielbereich"
                  type="number"
                  min="0"
                  step="0.5"
                  value={forecastSettings.surfMin}
                  onChange={(event) =>
                    setForecastSettings((settings) => ({
                      ...settings,
                      surfMin: Number(event.target.value),
                    }))
                  }
                />
                <input
                  aria-label="Oberer Zielbereich"
                  type="number"
                  min="0"
                  step="0.5"
                  value={forecastSettings.surfMax}
                  onChange={(event) =>
                    setForecastSettings((settings) => ({
                      ...settings,
                      surfMax: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="surf-window">
              <span>Pegel-Zielbereich</span>
              <div>
                <input
                  aria-label="Unterer Pegel-Zielbereich"
                  type="number"
                  min="0"
                  step="1"
                  value={forecastSettings.levelMin}
                  onChange={(event) =>
                    setForecastSettings((settings) => ({
                      ...settings,
                      levelMin: Number(event.target.value),
                    }))
                  }
                />
                <input
                  aria-label="Oberer Pegel-Zielbereich"
                  type="number"
                  min="0"
                  step="1"
                  value={forecastSettings.levelMax}
                  onChange={(event) =>
                    setForecastSettings((settings) => ({
                      ...settings,
                      levelMax: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <dl className="arrival-list">
              <div>
                <dt>Krössbach sichtbar</dt>
                <dd>{formatTime(forecastArrivalKroessbach)}</dd>
              </div>
              <div>
                <dt>Puig sichtbar</dt>
                <dd>{formatTime(forecastArrivalPuig)}</dd>
              </div>
              <div>
                <dt>Delta Welle</dt>
                <dd>
                  {expectedWaveDelta >= 0 ? "+" : ""}
                  {formatNumber(expectedWaveDelta, 2)} m³/s
                </dd>
              </div>
              <div>
                <dt>Bilanz 30 min</dt>
                <dd>{formatVolume(volumeBalance.balance30)} m³</dd>
              </div>
              <div>
                <dt>Bilanz 60 min</dt>
                <dd>{formatVolume(volumeBalance.balance60)} m³</dd>
              </div>
              <div>
                <dt>Bilanz 120 min</dt>
                <dd>{formatVolume(volumeBalance.balance120)} m³</dd>
              </div>
              <div>
                <dt>Reichenau-Äquivalent</dt>
                <dd>{formatTime(reichenauEquivalentTime)}</dd>
              </div>
              <div>
                <dt>Basis</dt>
                <dd>
                  {payload.historySource === "database"
                    ? "Datenbank + 15-min Ping"
                    : "15-min Live-Snapshots"}
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <p className="runtime-note">
          {kr?.waveRuntime ?? "Krössbach Laufzeit n/a"} ·{" "}
          {puig?.waveRuntime ?? "Puig Laufzeit n/a"}
        </p>
        <RuntimeCorrelationPanel summary={runtimeComparison} />
      </section>

      <section className="archive-section">
        <div className="section-heading archive-heading">
          <div>
            <p>Datenarchiv</p>
            <h2>Messpunkte für Auswertung</h2>
          </div>
          <div className="archive-state">
            <span>Datenbank</span>
            <strong>
              {payload.historySource === "database" ? "aktiv" : "lokal"}
            </strong>
          </div>
        </div>
        <div className="archive-grid">
          <div>
            <span>Chartbereich</span>
            <strong>
              {visibleHistoryPoints.length
                ? `${formatDate(chartTimeDomain.min)} - ${formatDate(chartTimeDomain.max)}`
                : "noch keine Historie"}
            </strong>
          </div>
          <div>
            <span>Aktuelle Zeitpunkte</span>
            <strong>{visibleHistoryPoints.length}</strong>
          </div>
          <div className="archive-actions" aria-label="CSV Archiv herunterladen">
            <a href="/api/history?days=2&format=csv" download>
              48 h CSV
            </a>
            <a href="/api/history?days=7&format=csv" download>
              7 Tage CSV
            </a>
            <a href="/api/history?days=30&format=csv" download>
              30 Tage CSV
            </a>
          </div>
        </div>
      </section>

      <PlatformSetupSection
        setupLogs={setupLogs}
        setupForm={setupForm}
        setupMessage={setupMessage}
        editingSetupId={editingSetupId}
        setupSaving={setupSaving}
        deletingSetupId={deletingSetupId}
        onFormChange={setSetupForm}
        onSubmit={submitSetupLog}
        onEdit={editSetupLog}
        onCancelEdit={cancelSetupEdit}
        onDelete={deleteSetupLog}
      />

      <section className="chart-section">
        <div className="section-heading">
          <p>Offizielle Ganglinien</p>
          <h2>{selected?.name ?? "Messstelle"}</h2>
        </div>
        <div className="toolbar">
          <div className="segmented" aria-label="Messstelle auswählen">
            {payload.stations.map((station) => (
              <button
                key={station.id}
                type="button"
                className={station.id === selectedStation ? "active" : ""}
                onClick={() => setSelectedStation(station.id)}
              >
                {station.shortName}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="Diagrammtyp auswählen">
            <button
              type="button"
              className={chartType === "W" ? "active" : ""}
              onClick={() => setChartType("W")}
            >
              Pegel
            </button>
            <button
              type="button"
              className={chartType === "Q" ? "active" : ""}
              onClick={() => setChartType("Q")}
            >
              Abfluss
            </button>
          </div>
        </div>
        <div className="chart-frame">
          {selected ? (
            <img
              src={`/api/hydro/plot?station=${selected.id}&type=${chartType}`}
              alt={`${chartType === "W" ? "Pegel" : "Abfluss"} ${selected.name}`}
            />
          ) : null}
        </div>
      </section>

      <footer className="source-line">
        Version 46 · Autor: Kilian Zotz · Quelle: {payload.source} + GeoSphere
        Austria. Messstellen: 202283, 201574, 201624.
      </footer>
    </main>
  );
}

function SpotInsightSection({
  observationsWithUpstream,
}: {
  observationsWithUpstream: number;
}) {
  return (
    <section className="spot-insight-section">
      <div className="section-heading spot-insight-heading">
        <div>
          <p>Spotinfos</p>
          <h2>Muster für gute und schlechte Konditionen</h2>
        </div>
        <div className="spot-insight-source">
          <span>Datenbasis</span>
          <strong>{spotInsightSummary.sample}</strong>
        </div>
      </div>

      <div className="spot-insight-grid">
        <details className="spot-insight-disclosure good">
          <summary>
            <span>Eher gut</span>
            <strong>{spotInsightSummary.good.length} Hinweise</strong>
          </summary>
          <InsightColumn title="Eher gut" tone="good" items={spotInsightSummary.good} />
        </details>
        <details className="spot-insight-disclosure bad">
          <summary>
            <span>Eher kritisch</span>
            <strong>{spotInsightSummary.bad.length} Hinweise</strong>
          </summary>
          <InsightColumn
            title="Eher kritisch"
            tone="bad"
            items={spotInsightSummary.bad}
          />
        </details>
        <details className="spot-insight-disclosure">
          <summary>
            <span>Korrelation</span>
            <strong>{observationsWithUpstream} Einträge</strong>
          </summary>
          <article className="correlation-card">
            <span>Nächster Lernschritt</span>
            <strong>Puig + Krössbach Korrelation</strong>
            <p>
              Neue Sessionwerte speichern bereits Abfluss und Pegel von Krössbach,
              Puig und Reichenau. Sobald genug Bewertungen da sind, vergleichen wir
              Wellenqualität gegen einzelne Zuflüsse, Summe, Delta, Pegel und
              Änderungsrate.
            </p>
            <dl>
              <div>
                <dt>Verknüpfte Einträge</dt>
                <dd>{observationsWithUpstream}</dd>
              </div>
              <div>
                <dt>Hypothese</dt>
                <dd>Menge + Trend + KW/Kanal-Umschaltung</dd>
              </div>
            </dl>
          </article>
        </details>
      </div>
    </section>
  );
}

function PlatformSetupSection({
  setupLogs,
  setupForm,
  setupMessage,
  editingSetupId,
  setupSaving,
  deletingSetupId,
  onFormChange,
  onSubmit,
  onEdit,
  onCancelEdit,
  onDelete,
}: {
  setupLogs: PlatformSetupLog[];
  setupForm: {
    loggedAt: string;
    waveMaster: string;
    chainLeftCm: string;
    chainRightCm: string;
    rampPosition: string;
    trimHeightCm: string;
    tensionLeft: string;
    tensionRight: string;
    waterLevelCm: string;
    dischargeCms: string;
    note: string;
  };
  setupMessage: string;
  editingSetupId: number | null;
  setupSaving: boolean;
  deletingSetupId: number | null;
  onFormChange: Dispatch<
    SetStateAction<{
      loggedAt: string;
      waveMaster: string;
      chainLeftCm: string;
      chainRightCm: string;
      rampPosition: string;
      trimHeightCm: string;
      tensionLeft: string;
      tensionRight: string;
      waterLevelCm: string;
      dischargeCms: string;
      note: string;
    }>
  >;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (log: PlatformSetupLog) => void;
  onCancelEdit: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <details className="dashboard-disclosure setup-section">
      <summary>
        <span>Setupwechselwerte</span>
        <strong>{setupLogs.length} Einträge</strong>
      </summary>
      <div className="section-heading setup-heading">
        <div>
          <p>Setupwechsel</p>
          <h2>Plattform & Rampe</h2>
        </div>
        <div className="setup-marker">
          <span>Marker aktiv ab</span>
          <strong>{formatDate(platformSetupChangeAt)}</strong>
        </div>
      </div>

      <div className="setup-note">
        Plattform wurde verstellt. Trimwerte ab diesem Marker werden als neues
        Setup betrachtet und sollten nicht direkt mit alten Trimwerten verglichen
        werden. Pegel und Abfluss werden passend zur eingetragenen Uhrzeit aus
        Reichenau übernommen.
      </div>

      <form className="setup-form" onSubmit={onSubmit}>
        <label>
          <span>Datum & Uhrzeit</span>
          <input
            type="datetime-local"
            required
            value={setupForm.loggedAt}
            onChange={(event) =>
              onFormChange((current) => ({ ...current, loggedAt: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Wellenmeister:in</span>
          <input
            type="text"
            value={setupForm.waveMaster}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                waveMaster: event.target.value,
              }))
            }
            placeholder="Name"
          />
        </label>
        <label>
          <span>Kettenzug li</span>
          <input
            type="number"
            min="0"
            step="1"
            value={setupForm.chainLeftCm}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                chainLeftCm: event.target.value,
              }))
            }
            placeholder="cm"
          />
        </label>
        <label>
          <span>Kettenzug re</span>
          <input
            type="number"
            min="0"
            step="1"
            value={setupForm.chainRightCm}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                chainRightCm: event.target.value,
              }))
            }
            placeholder="cm"
          />
        </label>
        <label>
          <span>Rampe</span>
          <input
            type="text"
            value={setupForm.rampPosition}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                rampPosition: event.target.value,
              }))
            }
            placeholder="z.B. Mittig"
          />
        </label>
        <label>
          <span>Trimmhöhe</span>
          <input
            type="number"
            min="0"
            step="1"
            value={setupForm.trimHeightCm}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                trimHeightCm: event.target.value,
              }))
            }
            placeholder="cm"
          />
        </label>
        <label>
          <span>Spannung li</span>
          <select
            value={setupForm.tensionLeft}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                tensionLeft: event.target.value,
              }))
            }
          >
            <option value="">-</option>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </label>
        <label>
          <span>Spannung re</span>
          <select
            value={setupForm.tensionRight}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                tensionRight: event.target.value,
              }))
            }
          >
            <option value="">-</option>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        </label>
        <div className="setup-auto-field">
          <span>Pegel Reichenau</span>
          <strong>{setupForm.waterLevelCm || "auto"}</strong>
        </div>
        <div className="setup-auto-field">
          <span>Abfluss Reichenau</span>
          <strong>{setupForm.dischargeCms || "auto"}</strong>
        </div>
        <label className="setup-note-field">
          <span>Bemerkungen</span>
          <input
            type="text"
            value={setupForm.note}
            onChange={(event) =>
              onFormChange((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Was wurde verändert, wie war die Welle?"
          />
        </label>
        <button type="submit" disabled={setupSaving}>
          {setupSaving
            ? "Speichert"
            : editingSetupId === null
              ? "Setup speichern"
              : "Aktualisieren"}
        </button>
        {editingSetupId !== null ? (
          <button
            type="button"
            className="secondary-action"
            onClick={onCancelEdit}
            disabled={setupSaving}
          >
            Abbrechen
          </button>
        ) : null}
      </form>

      {setupMessage ? <p className="setup-message">{setupMessage}</p> : null}

      <div className="setup-log-list">
        {setupLogs.map((log) => (
          <article key={log.id}>
            <div className="setup-log-head">
              <div>
                <span>{formatDate(log.loggedAt)}</span>
                <strong>{log.waveMaster ?? "Wellenmeister:in n/a"}</strong>
              </div>
              <button
                type="button"
                className="edit"
                onClick={() => onEdit(log)}
                disabled={setupSaving}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                disabled={deletingSetupId === log.id}
              >
                Löschen
              </button>
            </div>
            <dl>
              <div>
                <dt>Kettenzug li/re</dt>
                <dd>{formatSetupPair(log.chainLeftCm, log.chainRightCm)}</dd>
              </div>
              <div>
                <dt>Rampe</dt>
                <dd>{log.rampPosition ?? "-"}</dd>
              </div>
              <div>
                <dt>Trimmhöhe</dt>
                <dd>{formatOptionalCm(log.trimHeightCm)}</dd>
              </div>
              <div>
                <dt>Spannung li/re</dt>
                <dd>
                  {formatBooleanFlag(log.tensionLeft)} / {formatBooleanFlag(log.tensionRight)}
                </dd>
              </div>
              <div>
                <dt>Reichenau Messwert</dt>
                <dd>
                  {formatNumber(log.waterLevelCm, 1)} cm /{" "}
                  {formatNumber(log.dischargeCms, 2)} m³/s
                </dd>
              </div>
            </dl>
            {log.note ? <p>{log.note}</p> : null}
          </article>
        ))}
        {!setupLogs.length ? (
          <article>
            <div className="setup-log-head">
              <div>
                <span>Noch keine Setupwerte</span>
                <strong>Umbau-Log leer</strong>
              </div>
            </div>
            <p>Neue Plattformwerte erscheinen hier.</p>
          </article>
        ) : null}
      </div>
    </details>
  );
}

function InsightColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "bad";
  items: { label: string; value: string; detail: string }[];
}) {
  return (
    <article className={`insight-column ${tone}`}>
      <h3>{title}</h3>
      <div>
        {items.map((item) => (
          <section key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  unit,
  tone = "normal",
}: {
  label: string;
  value: string;
  unit: string;
  tone?: "normal" | "watch";
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>
        {value} <small>{unit}</small>
      </strong>
    </article>
  );
}

function DataQualityBox({ signal }: { signal: DataQualitySignal }) {
  return (
    <article className={`data-quality-box ${signal.label}`}>
      <div>
        <span>Bewertung aus Daten</span>
        <strong>
          {signal.score === null ? "n/a" : `${signal.score} %`}
        </strong>
      </div>
      <dl>
        <div>
          <dt>Aussagekraft</dt>
          <dd>{signal.label} · {signal.confidence} %</dd>
        </div>
        <div>
          <dt>Datenbasis</dt>
          <dd>{signal.sampleSize} Werte · {signal.basis}</dd>
        </div>
        <div>
          <dt>Ähnliche Punkte</dt>
          <dd>{signal.matchedCount}</dd>
        </div>
        <div>
          <dt>Neues Setup</dt>
          <dd>{signal.sameSetupCount} Werte</dd>
        </div>
      </dl>
      <p>{signal.note}</p>
    </article>
  );
}

function WaveQualityScale({
  projections,
}: {
  projections: WaveQualityProjection[];
}) {
  const best = projections.reduce<WaveQualityProjection | null>(
    (currentBest, point) =>
      currentBest === null || point.score > currentBest.score ? point : currentBest,
    null,
  );

  return (
    <article className="quality-scale-card">
      <div className="quality-scale-head">
        <div>
          <span>Nächste 2 Stunden</span>
          <strong>Wellenqualität im Verlauf</strong>
        </div>
        <p>{best ? `Bestwert ${formatTime(best.time)} · ${best.score} %` : "n/a"}</p>
      </div>
      <div className="quality-scale" aria-label="Wellenqualität nächste 2 Stunden">
        {projections.map((point) => (
          <div
            key={point.time}
            className={`quality-scale-point ${qualityTone(point.score)} ${
              best?.time === point.time ? "best" : ""
            }`}
          >
            <span>{formatTime(point.time)}</span>
            <div className="quality-scale-track">
              <i style={{ height: `${Math.max(4, point.score)}%` }} />
            </div>
            <strong>{point.score}%</strong>
          </div>
        ))}
        {!projections.length ? <p>Keine Forecastpunkte verfügbar.</p> : null}
      </div>
    </article>
  );
}

function WaveQualityCard({
  title,
  quality,
}: {
  title: string;
  quality: WaveQualityProjection;
}) {
  const tone = qualityTone(quality.score);

  return (
    <article className={`quality-card ${tone}`}>
      <div>
        <span>{title}</span>
        <strong>{qualityLabel(quality.score)}</strong>
      </div>
      <p>{quality.score} %</p>
      <div className="quality-meter" aria-label={`${title} ${quality.score} Prozent`}>
        <i style={{ width: `${quality.score}%` }} />
      </div>
      <dl>
        <div>
          <dt>Zeit</dt>
          <dd>{formatTime(quality.time)}</dd>
        </div>
        <div>
          <dt>Delta (Zufluss zu Abfluss)</dt>
          <dd>
            {quality.delta >= 0 ? "+" : ""}
            {formatNumber(quality.delta, 2)} m³/s
          </dd>
        </div>
        <div>
          <dt>Zuflüsse</dt>
          <dd>{formatNumber(quality.upstream, 2)} m³/s</dd>
        </div>
        <div>
          <dt>Tendenz (Zufluss)</dt>
          <dd>
            {quality.trend.label} · {formatSignedNumber(quality.trend.delta60, 2)} m³/s
          </dd>
        </div>
        <div>
          <dt>Pegel Reichenau</dt>
          <dd>{formatNumber(quality.level, 1)} cm</dd>
        </div>
        <div>
          <dt>Ø Differenz 60 min</dt>
          <dd>{formatVolumeBalanceFlow(quality.volumeBalance60)} m³/s</dd>
        </div>
        <div>
          <dt>Modell</dt>
          <dd>{quality.modelScore} %</dd>
        </div>
        <div>
          <dt>Daten*Gewichtung</dt>
          <dd>
            {quality.data.score === null
              ? "n/a"
              : `${quality.data.score} % · ${quality.data.confidence} %`}
          </dd>
        </div>
        <div>
          <dt>Modell + Daten</dt>
          <dd>{quality.dataScore} %</dd>
        </div>
        <div>
          <dt>Meister</dt>
          <dd>
            {quality.manual
              ? `${formatQuality(quality.manual.quality)}/5 · Trim: ${formatTrimCm(
                  quality.manual.trimCm,
                  quality.manual.trim,
                )}`
              : "n/a"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function RuntimeCorrelationPanel({
  summary,
}: {
  summary: RuntimeComparisonSummary;
}) {
  return (
    <section className="runtime-correlation">
      <div className="runtime-correlation-head">
        <div>
          <p>Laufzeit-Check <span className="beta-badge">BETA</span></p>
          <h3>Erwarteter Zufluss gegen Reichenau gemessen</h3>
        </div>
        <strong>{summary.count} Vergleiche</strong>
      </div>
      <div className="runtime-correlation-grid">
        <article>
          <span>Korrelation Summe</span>
          <strong>{formatCorrelation(summary.correlation)}</strong>
          <small>1,00 wäre sehr ähnlich; 0,00 kein lineares Muster.</small>
        </article>
        <article>
          <span>Ø Abweichung</span>
          <strong>{formatNumber(summary.meanAbsoluteDelta, 2)} m³/s</strong>
          <small>mittlerer Abstand zwischen Erwartung und Messung.</small>
        </article>
        <article>
          <span>Ø Delta</span>
          <strong>{formatSignedNumber(summary.meanDelta, 2)} m³/s</strong>
          <small>positiv heißt Reichenau kam höher als erwartet.</small>
        </article>
        <article>
          <span>Letzter Vergleich</span>
          <strong>
            {summary.latest
              ? `${formatNumber(summary.latest.expected, 2)} → ${formatNumber(
                  summary.latest.measured,
                  2,
                )}`
              : "n/a"}
          </strong>
          <small>erwartet aus Laufzeit → tatsächlich Reichenau.</small>
        </article>
      </div>
      <dl>
        <div>
          <dt>Krössbach einzeln</dt>
          <dd>{formatCorrelation(summary.kroessbachCorrelation)}</dd>
        </div>
        <div>
          <dt>Puig einzeln</dt>
          <dd>{formatCorrelation(summary.puigCorrelation)}</dd>
        </div>
        <div>
          <dt>Lernwerte Spotinfos</dt>
          <dd>noch nicht automatisch gewichtet</dd>
        </div>
      </dl>
    </section>
  );
}

function FlowNode({
  station,
  accent,
}: {
  station?: HydroStation;
  accent: "teal" | "gold" | "coral";
}) {
  return (
    <article className={`flow-node ${accent}`}>
      <span>{station?.river ?? "n/a"}</span>
      <strong>{station?.shortName ?? "n/a"}</strong>
      <p>
        {formatNumber(station?.discharge.value ?? null, 2)}{" "}
        {formatUnit(station?.discharge.unit ?? "m³/s")}
      </p>
    </article>
  );
}

function SurfForecastChart({
  history,
  forecast,
  timeDomain,
  markerTime,
  surfMin,
  surfMax,
  observations,
}: {
  history: HistoryPoint[];
  forecast: { t: number; value: number | null }[];
  timeDomain: TimeDomain;
  markerTime: number;
  surfMin: number;
  surfMax: number;
  observations: SurfObservation[];
}) {
  const [visible, setVisible] = useState<Record<FlowSeriesKey, boolean>>({
    trim: true,
    kroessbach: true,
    puig: true,
    upstream: true,
    reichenau: true,
    forecast: true,
    session: true,
    range: true,
  });
  const toggle = (key: FlowSeriesKey) =>
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  const observedKroessbach = history.map((point) => ({
    t: point.t,
    value: point.kroessbach,
  }));
  const observedPuig = history.map((point) => ({
    t: point.t,
    value: point.puig,
  }));
  const observedUpstream = history.map((point) => ({
    t: point.t,
    value:
      point.kroessbach === null && point.puig === null
        ? null
        : (point.kroessbach ?? 0) + (point.puig ?? 0),
  }));
  const observedReichenau = history.map((point) => ({
    t: point.t,
    value: point.reichenau,
  }));
  const sessionPoints = observations.map((observation) => ({
    id: observation.id,
    t: observation.observedAt,
    value: observation.reichenauDischarge,
    quality: observation.quality,
    trimCm: observation.trimCm,
    kroessbachDischarge: observation.kroessbachDischarge,
    puigDischarge: observation.puigDischarge,
    reichenauDischarge: observation.reichenauDischarge,
    kroessbachLevel: observation.kroessbachLevel,
    puigLevel: observation.puigLevel,
    reichenauLevel: observation.reichenauLevel,
  }));
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleKroessbach = observedKroessbach.filter(inTimeDomain);
  const visiblePuig = observedPuig.filter(inTimeDomain);
  const visibleUpstream = observedUpstream.filter(inTimeDomain);
  const visibleReichenau = observedReichenau.filter(inTimeDomain);
  const visibleForecast = forecast.filter(inTimeDomain);
  const visibleSessionPoints = sessionPoints.filter(inTimeDomain);
  const visibleTrimPoints = visibleSessionPoints
    .map((point) => ({ t: point.t, value: point.trimCm }))
    .filter((point): point is { t: number; value: number } => point.value !== null)
    .sort((a, b) => a.t - b.t);
  const allValues = [
    ...(visible.kroessbach ? visibleKroessbach : []),
    ...(visible.puig ? visiblePuig : []),
    ...(visible.upstream ? visibleUpstream : []),
    ...(visible.reichenau ? visibleReichenau : []),
    ...(visible.forecast ? visibleForecast : []),
    ...(visible.session ? visibleSessionPoints : []),
  ]
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  if (visible.range) allValues.push(surfMin, surfMax);
  const trimValues = visibleTrimPoints.map((point) => point.value);
  const minT = timeDomain.min;
  const maxT = timeDomain.max;
  const rawMinValue = Math.min(0, ...allValues);
  const rawMaxValue = Math.max(1, ...allValues);
  const valueRange = Math.max(1, rawMaxValue - rawMinValue);
  const minValue = rawMinValue - valueRange * 0.08;
  const maxValue = rawMaxValue + valueRange * 0.12;
  const rawTrimMin = Math.min(...trimValues, 220);
  const rawTrimMax = Math.max(...trimValues, 230);
  const trimRange = Math.max(1, rawTrimMax - rawTrimMin);
  const trimMin = rawTrimMin - trimRange * 0.12;
  const trimMax = rawTrimMax + trimRange * 0.12;
  const showTrim = visible.trim;
  const width = 820;
  const height = showTrim ? 430 : 360;
  const trimPlot = { top: 24, height: 48 };
  const plot = { left: 58, top: showTrim ? 100 : 20, right: 44, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (t: number) =>
    plot.left + ((t - minT) / Math.max(1, maxT - minT)) * plotWidth;
  const y = (value: number) =>
    plot.top +
    plotHeight -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const yTrim = (value: number) =>
    trimPlot.top +
    ((value - trimMin) / Math.max(1, trimMax - trimMin)) * trimPlot.height;
  const tickCount = 9;
  const tickStep = (maxValue - minValue) / (tickCount - 1);
  const yTicks = Array.from(
    new Set([
      ...Array.from(
        { length: tickCount },
        (_, index) => Number((minValue + tickStep * index).toFixed(2)),
      ),
      0,
    ]),
  ).sort((a, b) => a - b);
  const tickDecimals = tickStep < 5 ? 1 : 0;
  const xTicks = timeAxisTicks(minT, maxT);
  const gridTicks = timeGridTicks(minT, maxT);
  const surfY = Math.max(plot.top, y(surfMax));
  const surfBottom = Math.min(plot.top + plotHeight, y(surfMin));
  const surfHeight = Math.max(4, surfBottom - surfY);
  const zeroY = y(0);
  const markerX = x(markerTime);
  const trimSegments = splitLineSegments(
    visibleTrimPoints,
    5 * 60 * 60 * 1000,
  );

  return (
    <div className="forecast-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Abfluss im Verhältnis zur Zeit</title>
        {showTrim ? (
          <g>
            <text className="trim-title" x={plot.left} y={16}>
              Trim cm
            </text>
            <line
              className="trim-axis"
              x1={plot.left}
              x2={width - plot.right}
              y1={trimPlot.top}
              y2={trimPlot.top}
            />
            <line
              className="trim-axis"
              x1={plot.left}
              x2={width - plot.right}
              y1={trimPlot.top + trimPlot.height}
              y2={trimPlot.top + trimPlot.height}
            />
            <text
              className="trim-label"
              x={width - plot.right + 8}
              y={trimPlot.top + 4}
            >
              {formatNumber(trimMin, 0)}
            </text>
            <text
              className="trim-label"
              x={width - plot.right + 8}
              y={trimPlot.top + trimPlot.height + 4}
            >
              {formatNumber(trimMax, 0)}
            </text>
            {trimSegments.solid.map((segment, index) => (
              <path
                key={`trim-solid-${index}`}
                className="line trim"
                d={linePath(segment, x, yTrim)}
              />
            ))}
            {trimSegments.gaps.map((segment, index) => (
              <path
                key={`trim-gap-${index}`}
                className="line trim trim-gap"
                d={linePath(segment, x, yTrim)}
              />
            ))}
            {visibleTrimPoints.map((point) => (
              <circle
                key={`${point.t}-${point.value}`}
                className="trim-dot"
                cx={x(point.t)}
                cy={yTrim(point.value)}
                r="3.5"
              />
            ))}
          </g>
        ) : null}
        {gridTicks.map((tick) => (
          <line
            key={tick.t}
            className={`time-grid-line ${tick.major ? "major" : "minor"}`}
            x1={x(tick.t)}
            x2={x(tick.t)}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
        ))}
        <rect
          className="surf-range"
          x={plot.left}
          y={surfY}
          width={plotWidth}
          height={surfHeight}
          opacity={visible.range ? 1 : 0}
        />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={12} y={y(tick) + 4}>
              {formatNumber(tick, tickDecimals)}
            </text>
          </g>
        ))}
        {zeroY >= plot.top && zeroY <= plot.top + plotHeight ? (
          <g>
            <line
              className="zero-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={zeroY}
              y2={zeroY}
            />
            <text
              className="zero-label"
              x={width - plot.right - 8}
              y={zeroY - 8}
              textAnchor="end"
            >
              0
            </text>
          </g>
        ) : null}
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 12} textAnchor="middle">
            {formatAxisTime(tick, maxT - minT)}
          </text>
        ))}
        {markerX >= plot.left && markerX <= width - plot.right ? (
          <g>
            <line
              className="marker-line"
              x1={markerX}
              x2={markerX}
              y1={plot.top}
              y2={plot.top + plotHeight}
            />
            <text className="marker-label" x={markerX + 7} y={plot.top + 12}>
              Messpunkt
            </text>
          </g>
        ) : null}
        {visible.kroessbach ? (
          <path
            className="line kroessbach"
            d={linePath(visibleKroessbach, x, y)}
          />
        ) : null}
        {visible.puig ? <path className="line puig" d={linePath(visiblePuig, x, y)} /> : null}
        {visible.upstream ? (
          <path
            className="line upstream"
            d={linePath(visibleUpstream, x, y)}
          />
        ) : null}
        {visible.reichenau ? (
          <path
            className="line reichenau"
            d={linePath(visibleReichenau, x, y)}
          />
        ) : null}
        {visible.forecast ? (
          <path className="line forecast" d={linePath(visibleForecast, x, y)} />
        ) : null}
        {visible.session ? visibleSessionPoints.map((point) =>
          point.value === null ? null : (
            <g key={point.id}>
              <title>
                {`Session ${formatTime(point.t)} · Qualität ${formatQuality(point.quality)}/5 · Trim ${formatTrimCm(
                  point.trimCm,
                  "",
                )} · Abfluss K/P/R ${formatTriple(
                  point.kroessbachDischarge,
                  point.puigDischarge,
                  point.reichenauDischarge,
                  2,
                )} m³/s · Pegel K/P/R ${formatTriple(
                  point.kroessbachLevel,
                  point.puigLevel,
                  point.reichenauLevel,
                  1,
                )} cm`}
              </title>
              <circle
                className={`session-dot ${ratingClass(point.quality)}`}
                cx={x(point.t)}
                cy={y(point.value)}
                r="4"
              />
              <text
                className="session-label"
                x={x(point.t)}
                y={y(point.value) - 7}
                textAnchor="middle"
              >
                {formatQuality(point.quality)}
              </text>
            </g>
          ),
        ) : null}
      </svg>
      <div className="chart-legend">
        <LegendToggle name="trim" active={visible.trim} onClick={() => toggle("trim")}>
          Trim cm
        </LegendToggle>
        <LegendToggle name="kroessbach" active={visible.kroessbach} onClick={() => toggle("kroessbach")}>
          Krössbach
        </LegendToggle>
        <LegendToggle name="puig" active={visible.puig} onClick={() => toggle("puig")}>
          Puig
        </LegendToggle>
        <LegendToggle name="upstream" active={visible.upstream} onClick={() => toggle("upstream")}>
          Krössbach + Puig
        </LegendToggle>
        <LegendToggle name="reichenau" active={visible.reichenau} onClick={() => toggle("reichenau")}>
          Reichenau gemessen
        </LegendToggle>
        <LegendToggle name="forecast" active={visible.forecast} onClick={() => toggle("forecast")}>
          Forecast Reichenau <b>BETA</b>
        </LegendToggle>
        <LegendToggle name="session" active={visible.session} onClick={() => toggle("session")}>
          Sessionwerte
        </LegendToggle>
        <LegendToggle name="range" active={visible.range} onClick={() => toggle("range")}>
          Zielbereich
        </LegendToggle>
      </div>
    </div>
  );
}

function SurfDeltaChart({
  delta,
  timeDomain,
  markerTime,
}: {
  delta: { t: number; value: number | null }[];
  timeDomain: TimeDomain;
  markerTime: number;
}) {
  const [visible, setVisible] = useState<Record<DeltaSeriesKey, boolean>>({
    delta: true,
  });
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleDelta = delta.filter(inTimeDomain);
  const values = visibleDelta
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const minT = timeDomain.min;
  const maxT = timeDomain.max;
  const maxAbs = Math.max(0.8, ...values.map((value) => Math.abs(value))) * 1.18;
  const minValue = -maxAbs;
  const maxValue = maxAbs;
  const width = 820;
  const height = 250;
  const plot = { left: 58, top: 44, right: 20, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (t: number) =>
    plot.left + ((t - minT) / Math.max(1, maxT - minT)) * plotWidth;
  const y = (value: number) =>
    plot.top +
    plotHeight -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const yTicks = Array.from({ length: 7 }, (_, index) =>
    Number((minValue + ((maxValue - minValue) / 6) * index).toFixed(2)),
  );
  const xTicks = timeAxisTicks(minT, maxT);
  const gridTicks = timeGridTicks(minT, maxT);
  const zeroY = y(0);
  const markerX = x(markerTime);

  return (
    <div className="forecast-chart delta-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Delta der Welle im Verhältnis zur Zeit</title>
        <text className="chart-title" x={plot.left} y={16}>
          Delta Welle im Zeitverlauf
        </text>
        <text className="chart-subtitle" x={plot.left} y={31}>
          Abfluss Reichenau - Summe Puig/Krössbach mit Laufzeitkorrektur
        </text>
        {gridTicks.map((tick) => (
          <line
            key={tick.t}
            className={`time-grid-line ${tick.major ? "major" : "minor"}`}
            x1={x(tick.t)}
            x2={x(tick.t)}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={12} y={y(tick) + 4}>
              {formatNumber(tick, 1)}
            </text>
          </g>
        ))}
        <line
          className="zero-line"
          x1={plot.left}
          x2={width - plot.right}
          y1={zeroY}
          y2={zeroY}
        />
        <text
          className="zero-label"
          x={width - plot.right - 8}
          y={zeroY - 8}
          textAnchor="end"
        >
          0
        </text>
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 12} textAnchor="middle">
            {formatAxisTime(tick, maxT - minT)}
          </text>
        ))}
        {markerX >= plot.left && markerX <= width - plot.right ? (
          <g>
            <line
              className="marker-line"
              x1={markerX}
              x2={markerX}
              y1={plot.top}
              y2={plot.top + plotHeight}
            />
            <text className="marker-label" x={markerX + 7} y={plot.top + 12}>
              Messpunkt
            </text>
          </g>
        ) : null}
        {visible.delta ? (
          <path className="line delta" d={linePath(visibleDelta, x, y)} />
        ) : null}
      </svg>
      <div className="chart-legend">
        <LegendToggle
          name="delta"
          active={visible.delta}
          onClick={() => setVisible((current) => ({ ...current, delta: !current.delta }))}
        >
          Delta Welle
        </LegendToggle>
      </div>
    </div>
  );
}

function SurfVolumeBalanceChart({
  balance,
  timeDomain,
  markerTime,
  balance30,
  balance60,
  balance120,
}: {
  balance: { t: number; value: number | null }[];
  timeDomain: TimeDomain;
  markerTime: number;
  balance30: number | null;
  balance60: number | null;
  balance120: number | null;
}) {
  const [visible, setVisible] = useState<Record<VolumeSeriesKey, boolean>>({
    volume60: true,
  });
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleBalance = balance.filter(inTimeDomain);
  const values = visible.volume60
    ? visibleBalance
        .map((point) => point.value)
        .filter((value): value is number => typeof value === "number")
    : [];
  const minT = timeDomain.min;
  const maxT = timeDomain.max;
  const maxAbs = Math.max(500, ...values.map((value) => Math.abs(value))) * 1.18;
  const minValue = -maxAbs;
  const maxValue = maxAbs;
  const width = 820;
  const height = 270;
  const plot = { left: 72, top: 60, right: 24, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (t: number) =>
    plot.left + ((t - minT) / Math.max(1, maxT - minT)) * plotWidth;
  const y = (value: number) =>
    plot.top +
    plotHeight -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Number((minValue + ((maxValue - minValue) / 4) * index).toFixed(0)),
  );
  const xTicks = timeAxisTicks(minT, maxT);
  const gridTicks = timeGridTicks(minT, maxT);
  const zeroY = y(0);
  const markerX = x(markerTime);

  return (
    <div className="forecast-chart volume-chart">
      <div className="volume-summary" aria-label="Volumenbilanz Übersicht">
        <div>
          <span>30 min</span>
          <strong>{formatVolume(balance30)} m³</strong>
        </div>
        <div>
          <span>60 min</span>
          <strong>{formatVolume(balance60)} m³</strong>
        </div>
        <div>
          <span>120 min</span>
          <strong>{formatVolume(balance120)} m³</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Volumenbilanz aus Delta im Verhältnis zur Zeit</title>
        <text className="chart-title" x={plot.left} y={18}>
          Volumenbilanz
        </text>
        <text className="chart-subtitle" x={plot.left} y={34}>
          Rollende 60 min aus Delta m³/s integriert
        </text>
        {gridTicks.map((tick) => (
          <line
            key={tick.t}
            className={`time-grid-line ${tick.major ? "major" : "minor"}`}
            x1={x(tick.t)}
            x2={x(tick.t)}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={12} y={y(tick) + 4}>
              {formatVolume(tick)}
            </text>
          </g>
        ))}
        <line
          className="zero-line"
          x1={plot.left}
          x2={width - plot.right}
          y1={zeroY}
          y2={zeroY}
        />
        <text
          className="zero-label"
          x={width - plot.right - 8}
          y={zeroY - 8}
          textAnchor="end"
        >
          0 m³
        </text>
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 12} textAnchor="middle">
            {formatAxisTime(tick, maxT - minT)}
          </text>
        ))}
        {markerX >= plot.left && markerX <= width - plot.right ? (
          <g>
            <line
              className="marker-line"
              x1={markerX}
              x2={markerX}
              y1={plot.top}
              y2={plot.top + plotHeight}
            />
            <text className="marker-label" x={markerX + 7} y={plot.top + 12}>
              Messpunkt
            </text>
          </g>
        ) : null}
        {visible.volume60 ? (
          <path className="line volume" d={linePath(visibleBalance, x, y)} />
        ) : null}
      </svg>
      <div className="chart-legend">
        <LegendToggle
          name="volume"
          active={visible.volume60}
          onClick={() =>
            setVisible((current) => ({ ...current, volume60: !current.volume60 }))
          }
        >
          Volumenbilanz 60 min
        </LegendToggle>
      </div>
    </div>
  );
}

function RainfallSection({
  weather,
  visiblePoints,
  timeDomain,
  markerTime,
  rain1h,
  rain3h,
  rain6h,
  rain12h,
  error,
}: {
  weather: WeatherPayload;
  visiblePoints: WeatherPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
  rain1h: ReturnType<typeof rainfallTotals>;
  rain3h: ReturnType<typeof rainfallTotals>;
  rain6h: ReturnType<typeof rainfallTotals>;
  rain12h: ReturnType<typeof rainfallTotals>;
  error: string;
}) {
  return (
    <section className="rain-section">
      <div className="rain-section-head">
        <div>
          <p>
            Regenanalyse <span className="beta-badge">BETA</span>
          </p>
          <h3>GeoSphere Niederschlag im Einzugsgebiet</h3>
        </div>
        <div className="rain-source">
          <span>{weather.historySource === "database" ? "Datenbank" : "Quelle"}</span>
          <strong>{weather.historySource === "database" ? "mitgeschrieben" : "GeoSphere"}</strong>
        </div>
      </div>
      {error ? <div className="notice rain-notice">{error}</div> : null}
      <div className="rain-summary-grid">
        <RainSummaryCard label="Letzte 1 h" total={rain1h} />
        <RainSummaryCard label="Letzte 3 h" total={rain3h} />
        <RainSummaryCard label="Letzte 6 h" total={rain6h} />
        <RainSummaryCard label="Letzte 12 h" total={rain12h} />
      </div>
      <RainfallChart
        stations={weather.stations}
        points={visiblePoints}
        timeDomain={timeDomain}
        markerTime={markerTime}
      />
      <p className="rain-note">
        Die Balken zeigen das Gebietsmittel der ausgewählten Stationen. Das Signal
        wird erst nach der Auswertung gegen Delta, Pegel und Abfluss in die
        Wellenqualität gewichtet.
      </p>
    </section>
  );
}

function RainSummaryCard({
  label,
  total,
}: {
  label: string;
  total: ReturnType<typeof rainfallTotals>;
}) {
  return (
    <article className="rain-summary-card">
      <span>{label}</span>
      <strong>{formatNumber(total.areaMean, 1)} mm</strong>
      <small>
        Max Station {formatNumber(total.maxStation, 1)} mm · {total.stationCount} Stationen
      </small>
    </article>
  );
}

function RainfallChart({
  stations,
  points,
  timeDomain,
  markerTime,
}: {
  stations: WeatherStation[];
  points: WeatherPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
}) {
  const [visible, setVisible] = useState<Record<RainSeriesKey, boolean>>({
    area: true,
    innsbruck_uni: false,
    neustift: true,
    steinach: true,
    brenner: true,
    patscherkofel: false,
  });
  const toggle = (key: RainSeriesKey) =>
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  const aggregate = aggregateRainSeries(points);
  const stationLines = stations.map((station) => ({
    station,
    points: weatherStationSeries(points, station.id),
  }));
  const activeStationValues = stationLines
    .filter((series) => visible[series.station.id as RainSeriesKey])
    .flatMap((series) => series.points)
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const aggregateValues = visible.area
    ? aggregate.map((point) => point.value)
    : [];
  const allValues = [...aggregateValues, ...activeStationValues];
  const minT = timeDomain.min;
  const maxT = timeDomain.max;
  const maxValue = Math.max(1, ...allValues) * 1.22;
  const width = 820;
  const height = 290;
  const plot = { left: 58, top: 40, right: 24, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (t: number) =>
    plot.left + ((t - minT) / Math.max(1, maxT - minT)) * plotWidth;
  const y = (value: number) =>
    plot.top + plotHeight - (value / Math.max(1, maxValue)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Number(((maxValue / 4) * index).toFixed(1)),
  );
  const xTicks = timeAxisTicks(minT, maxT);
  const gridTicks = timeGridTicks(minT, maxT);
  const markerX = x(markerTime);
  const barWidth = clamp((plotWidth / Math.max(1, aggregate.length)) * 0.72, 2, 10);

  return (
    <div className="forecast-chart rain-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Regen im Verhältnis zur Zeit</title>
        <text className="chart-title" x={plot.left} y={18}>
          Niederschlag im Zeitverlauf
        </text>
        <text className="chart-subtitle" x={plot.left} y={34}>
          10-min Regenwerte in mm, gleiche Zeitachse wie Abfluss und Pegel
        </text>
        {gridTicks.map((tick) => (
          <line
            key={tick.t}
            className={`time-grid-line ${tick.major ? "major" : "minor"}`}
            x1={x(tick.t)}
            x2={x(tick.t)}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
        ))}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={12} y={y(tick) + 4}>
              {formatNumber(tick, 1)}
            </text>
          </g>
        ))}
        {visible.area
          ? aggregate.map((point) => (
              <rect
                key={point.t}
                className="rain-bar"
                x={x(point.t) - barWidth / 2}
                y={y(point.value)}
                width={barWidth}
                height={Math.max(1, plot.top + plotHeight - y(point.value))}
              />
            ))
          : null}
        {stationLines.map(({ station, points: stationPoints }) =>
          visible[station.id as RainSeriesKey] ? (
            <path
              key={station.id}
              className={`line rain-station ${station.id}`}
              d={linePath(stationPoints, x, y)}
            />
          ) : null,
        )}
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 12} textAnchor="middle">
            {formatAxisTime(tick, maxT - minT)}
          </text>
        ))}
        {markerX >= plot.left && markerX <= width - plot.right ? (
          <g>
            <line
              className="marker-line"
              x1={markerX}
              x2={markerX}
              y1={plot.top}
              y2={plot.top + plotHeight}
            />
            <text className="marker-label" x={markerX + 7} y={plot.top + 12}>
              Messpunkt
            </text>
          </g>
        ) : null}
      </svg>
      <div className="chart-legend">
        <LegendToggle name="rain-area" active={visible.area} onClick={() => toggle("area")}>
          Gebietsmittel Regen
        </LegendToggle>
        {stations.map((station) => (
          <LegendToggle
            key={station.id}
            name={`rain-${station.id}`}
            active={visible[station.id as RainSeriesKey]}
            onClick={() => toggle(station.id as RainSeriesKey)}
          >
            {station.shortName}
          </LegendToggle>
        ))}
      </div>
    </div>
  );
}

function SurfLevelChart({
  history,
  timeDomain,
  markerTime,
  levelMin,
  levelMax,
}: {
  history: HistoryPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
  levelMin: number;
  levelMax: number;
}) {
  const [visible, setVisible] = useState<Record<LevelSeriesKey, boolean>>({
    kroessbach: true,
    puig: true,
    reichenau: true,
    range: true,
  });
  const toggle = (key: LevelSeriesKey) =>
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  const kroessbachLevel = history.map((point) => ({
    t: point.t,
    value: point.kroessbachLevel,
  }));
  const puigLevel = history.map((point) => ({
    t: point.t,
    value: point.puigLevel,
  }));
  const reichenauLevel = history.map((point) => ({
    t: point.t,
    value: point.reichenauLevel,
  }));
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleKroessbachLevel = kroessbachLevel.filter(inTimeDomain);
  const visiblePuigLevel = puigLevel.filter(inTimeDomain);
  const visibleReichenauLevel = reichenauLevel.filter(inTimeDomain);
  const series = [
    ...(visible.kroessbach ? visibleKroessbachLevel : []),
    ...(visible.puig ? visiblePuigLevel : []),
    ...(visible.reichenau ? visibleReichenauLevel : []),
  ];
  const allValues = series
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  if (visible.range) allValues.push(levelMin, levelMax);
  const minT = timeDomain.min;
  const maxT = timeDomain.max;
  const rawMinValue = Math.min(...allValues, 0);
  const rawMaxValue = Math.max(...allValues, 1);
  const valueRange = Math.max(1, rawMaxValue - rawMinValue);
  const minValue = Math.max(0, rawMinValue - valueRange * 0.08);
  const maxValue = rawMaxValue + valueRange * 0.12;
  const width = 820;
  const height = 300;
  const plot = { left: 58, top: 26, right: 20, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (t: number) =>
    plot.left + ((t - minT) / Math.max(1, maxT - minT)) * plotWidth;
  const y = (value: number) =>
    plot.top +
    plotHeight -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const tickCount = 7;
  const tickStep = (maxValue - minValue) / (tickCount - 1);
  const yTicks = Array.from({ length: tickCount }, (_, index) =>
    Number((minValue + tickStep * index).toFixed(1)),
  );
  const xTicks = timeAxisTicks(minT, maxT);
  const gridTicks = timeGridTicks(minT, maxT);
  const levelY = Math.max(plot.top, y(levelMax));
  const levelBottom = Math.min(plot.top + plotHeight, y(levelMin));
  const levelHeight = Math.max(4, levelBottom - levelY);
  const markerX = x(markerTime);

  return (
    <div className="forecast-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Pegel im Verhältnis zur Zeit</title>
        <text className="chart-title" x={plot.left} y={16}>
          Pegel im Zeitverlauf
        </text>
        {gridTicks.map((tick) => (
          <line
            key={tick.t}
            className={`time-grid-line ${tick.major ? "major" : "minor"}`}
            x1={x(tick.t)}
            x2={x(tick.t)}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
        ))}
        <rect
          className="level-range"
          x={plot.left}
          y={levelY}
          width={plotWidth}
          height={levelHeight}
          opacity={visible.range ? 1 : 0}
        />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={12} y={y(tick) + 4}>
              {formatNumber(tick, 0)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 12} textAnchor="middle">
            {formatAxisTime(tick, maxT - minT)}
          </text>
        ))}
        {markerX >= plot.left && markerX <= width - plot.right ? (
          <g>
            <line
              className="marker-line"
              x1={markerX}
              x2={markerX}
              y1={plot.top}
              y2={plot.top + plotHeight}
            />
            <text className="marker-label" x={markerX + 7} y={plot.top + 12}>
              Messpunkt
            </text>
          </g>
        ) : null}
        {visible.kroessbach ? (
          <path
            className="line kroessbach"
            d={linePath(visibleKroessbachLevel, x, y)}
          />
        ) : null}
        {visible.puig ? (
          <path className="line puig" d={linePath(visiblePuigLevel, x, y)} />
        ) : null}
        {visible.reichenau ? (
          <path
            className="line reichenau"
            d={linePath(visibleReichenauLevel, x, y)}
          />
        ) : null}
      </svg>
      <div className="chart-legend">
        <LegendToggle name="kroessbach" active={visible.kroessbach} onClick={() => toggle("kroessbach")}>
          Krössbach Pegel
        </LegendToggle>
        <LegendToggle name="puig" active={visible.puig} onClick={() => toggle("puig")}>
          Puig Pegel
        </LegendToggle>
        <LegendToggle name="reichenau" active={visible.reichenau} onClick={() => toggle("reichenau")}>
          Reichenau Pegel
        </LegendToggle>
        <LegendToggle name="level-range" active={visible.range} onClick={() => toggle("range")}>
          Pegel-Zielbereich
        </LegendToggle>
      </div>
    </div>
  );
}

function LegendToggle({
  name,
  active,
  onClick,
  children,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${name} ${active ? "active" : "inactive"}`}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function splitLineSegments<T extends { t: number; value: number | null }>(
  points: T[],
  maxSolidGapMs: number,
) {
  const validPoints = points
    .filter((point) => point.value !== null)
    .sort((a, b) => a.t - b.t);
  const solid: T[][] = [];
  const gaps: T[][] = [];
  let current: T[] = [];

  validPoints.forEach((point, index) => {
    const previous = validPoints[index - 1];

    if (previous && point.t - previous.t > maxSolidGapMs) {
      if (current.length >= 2) solid.push(current);
      gaps.push([previous, point]);
      current = [point];
      return;
    }

    current.push(point);
  });

  if (current.length >= 2) solid.push(current);

  return { solid, gaps };
}

function linePath(
  points: { t: number; value: number | null }[],
  x: (time: number) => number,
  y: (value: number) => number,
) {
  return points
    .filter((point) => point.value !== null)
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${x(point.t).toFixed(1)} ${y(point.value ?? 0).toFixed(1)}`;
    })
    .join(" ");
}

function ChartTimeControl({
  range,
  historyCount,
  totalHistoryCount,
  fromLabel,
  toLabel,
  onChange,
}: {
  range: ReviewRange;
  historyCount: number;
  totalHistoryCount: number;
  fromLabel: string;
  toLabel: string;
  onChange: (range: ReviewRange) => void;
}) {
  return (
    <div className="chart-time-control">
      <div className="chart-time-head">
        <span>Zeitbereich</span>
        <strong>{fromLabel} bis {toLabel}</strong>
      </div>
      <div className="review-presets" role="group" aria-label="Rückblick wählen">
        {reviewPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={range.preset === preset.id ? "active" : ""}
            onClick={() =>
              onChange({
                ...range,
                preset: preset.id,
              })
            }
          >
            {preset.label}
          </button>
        ))}
      </div>
      {range.preset === "custom" ? (
        <div className="date-range">
        <label>
          <span>Von Datum</span>
          <input
            type="date"
            value={dateInputValue(range.fromDate)}
            onChange={(event) =>
              onChange({
                ...range,
                preset: "custom",
                fromDate: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Bis Datum</span>
          <input
            type="date"
            value={dateInputValue(range.toDate)}
            onChange={(event) =>
              onChange({
                ...range,
                preset: "custom",
                toDate: event.target.value,
              })
            }
          />
        </label>
        </div>
      ) : null}
      <p>
        {historyCount} von {totalHistoryCount} Punkten · Mausrad/Pinch zoomt, Ziehen/Wischen verschiebt.
      </p>
    </div>
  );
}

function RuntimeControl({
  label,
  hint,
  beta = false,
  value,
  min,
  max,
  step = 5,
  unit = "min",
  onChange,
}: {
  label: string;
  hint?: string;
  beta?: boolean;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="runtime-control">
      <span>
        {label} {beta ? <b>BETA</b> : null}
      </span>
      {hint ? <em>{hint}</em> : null}
      <strong>
        {value} {unit}
      </strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StationPanel({ station }: { station: HydroStation }) {
  const waterPct = pct(station.water.value, station.thresholds.hw1.value);
  const hw30Pct = pct(station.water.value, station.thresholds.hw30.value);
  const tone = statusTone(station);

  return (
    <article className={`station-panel ${tone}`}>
      <header>
        <div>
          <span>{station.river}</span>
          <h3>{station.name}</h3>
        </div>
        <b>{station.water.classification ?? "ohne Klasse"}</b>
      </header>

      <dl className="reading-grid">
        <div>
          <dt>Pegel</dt>
          <dd>
            {formatNumber(station.water.value, 1)}{" "}
            <small>{formatUnit(station.water.unit)}</small>
          </dd>
        </div>
        <div>
          <dt>Abfluss</dt>
          <dd>
            {formatNumber(station.discharge.value, 2)}{" "}
            <small>{formatUnit(station.discharge.unit)}</small>
          </dd>
        </div>
        <div>
          <dt>Tendenz</dt>
          <dd>{tendencyLabel(station.water.tendency)}</dd>
        </div>
        <div>
          <dt>Messzeit</dt>
          <dd>{formatDate(station.water.dt)}</dd>
        </div>
      </dl>

      <div className="thresholds">
        <div>
          <span>HW1</span>
          <strong>
            {formatNumber(station.thresholds.hw1.value, 0)}{" "}
            {formatUnit(station.thresholds.hw1.unit)}
          </strong>
        </div>
        <div className="track">
          <i style={{ width: `${waterPct}%` }} />
        </div>
        <div>
          <span>HW30</span>
          <strong>
            {formatNumber(station.thresholds.hw30.value, 0)}{" "}
            {formatUnit(station.thresholds.hw30.unit)}
          </strong>
        </div>
        <div className="track subtle">
          <i style={{ width: `${hw30Pct}%` }} />
        </div>
      </div>

      <p className="station-meta">
        {station.role} · {station.altitude ? `${station.altitude} m` : "Hoehe n/a"}
      </p>
    </article>
  );
}
