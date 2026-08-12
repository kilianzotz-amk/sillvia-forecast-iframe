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
  source: "GeoSphere Klima" | "GeoSphere TAWES" | "GeoSphere Nowcast";
};

type WeatherPayload = {
  fetchedAt: string;
  source: string;
  stations: WeatherStation[];
  history: WeatherPoint[];
  forecast?: WeatherPoint[];
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
  gaerberbachLevel: number | null;
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

type ObservationFormState = {
  observedAt: string;
  trimCm: string;
  quality: number;
  note: string;
};

type PlatformSetupFormState = {
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

type TrimSuggestion = {
  trimCm: number | null;
  minCm: number | null;
  maxCm: number | null;
  confidence: number;
  sampleSize: number;
  matchedCount: number;
  basis: "gute ähnliche Werte" | "ähnliche Werte" | "zu wenig Daten";
  note: string;
};

type SessionReport = {
  timeDomain: TimeDomain;
  sessionDomain: TimeDomain;
  rangeLabel: string;
  sessionLabel: string;
  generatedAt: number;
  observationCount: number;
  averageQuality: number | null;
  bestObservation: SurfObservation | null;
  averageTrim: number | null;
  trimMin: number | null;
  trimMax: number | null;
  averageUpstream: number | null;
  averageReichenau: number | null;
  averageLevel: number | null;
  averageDelta: number | null;
  description: string;
  notes: string[];
  entries: SurfObservation[];
};

type ReportSessionOption = {
  id: string;
  label: string;
  start: number;
  end: number;
  count: number;
};

type ReportChartMarker = {
  id: number;
  t: number;
  value: number | null;
  label: string;
  quality: number;
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
  trimSuggestion: TrimSuggestion;
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
  recommendation: RuntimeRecommendation | null;
};

type RuntimeRecommendation = {
  lagKroessbach: number;
  lagPuig: number;
  correlation: number | null;
  meanAbsoluteDelta: number | null;
  count: number;
  confidence: number;
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

type ExperienceTargets = {
  flowMin: number;
  flowMax: number;
  levelMin: number;
  levelMax: number;
  sampleSize: number;
  sameSetupCount: number;
  confidence: number;
  basis: "aktuelles Setup" | "alle Setups" | "Fallback";
};

type SpotInsightStats = {
  total: number;
  linked: number;
  good: number;
  critical: number;
  averageGoodQuality: number | null;
  averageGoodTrim: number | null;
  goodDeltaAverage: number | null;
  levelFlowCorrelation: number | null;
  levelFlowCount: number;
  targetLevelFlowCorrelation: number | null;
  targetCorrelationCount: number;
};

type ReviewPreset = "24h" | "week" | "month" | "year" | "all" | "custom";

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

type VolumeWindowMinutes = 30 | 60 | 120;

type LevelSeriesKey =
  | "kroessbach"
  | "puig"
  | "gaerberbach"
  | "reichenau"
  | "session"
  | "range";

type RainSeriesKey =
  | "area"
  | "forecast"
  | "innsbruck_uni"
  | "neustift"
  | "steinach"
  | "brenner"
  | "patscherkofel";

const gaerberbachStationId = "riverapp-gaerberbach";
const stationOrder = ["202283", "201574", "201624", gaerberbachStationId];
const historyStorageKey = "sill-surf-forecast-history-v1";
const settingsStorageKey = "sill-surf-forecast-settings-v1";
const reviewRangeStorageKey = "sill-surf-review-range-v1";
const sampleInterval = 15 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const reportSessionGapMs = 3 * hourMs;
const reportContextMs = hourMs;
const observationLearningHours = 365 * 24;
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
const fallbackExperienceTargets: ExperienceTargets = {
  flowMin: defaultForecastSettings.surfMin,
  flowMax: defaultForecastSettings.surfMax,
  levelMin: defaultForecastSettings.levelMin,
  levelMax: defaultForecastSettings.levelMax,
  sampleSize: 0,
  sameSetupCount: 0,
  confidence: 0,
  basis: "Fallback",
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
const chartHorizontalWheelSensitivity = 0.035;
const chartHorizontalDragSensitivity = 0.45;
const defaultWeatherPayload: WeatherPayload = {
  fetchedAt: new Date().toISOString(),
  source: "GeoSphere Austria",
  history: [],
  forecast: [],
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
  { id: "24h", label: "24 h" },
  { id: "week", label: "Letzte Woche" },
  { id: "month", label: "Letzter Monat" },
  { id: "year", label: "Jahr" },
  { id: "all", label: "Alle Daten" },
  { id: "custom", label: "Zeitraum" },
];
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
        "Laufzeit der Hochwasserwelle bis zum Pegel Reichenau: 1,25-2,5 Stunden; Beschleunigung aufgrund seitlicher Zuflüsse möglich!; Fließstrecke 29,9 km",
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
        "Laufzeit der Hochwasserwelle bis zum Pegel Reichenau: 1-2 Stunden; Beschleunigung aufgrund seitlicher Zuflüsse möglich!; Fließstrecke 24,3 km",
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
    {
      id: gaerberbachStationId,
      shortName: "Gärberbach",
      name: "Gärberbach",
      river: "Sill",
      role: "Pegel nahe Welle · RiverApp lokaler Mitwirkender",
      altitude: null,
      waveRuntime:
        "Pegel-Reaktionssignal: Messpunkt ca. 3,6 km flussauf der Welle, angenommene Laufzeit bis zur Welle ca. 10 min.",
      latlng: [47.2316663811399, 11.3901517974556],
      water: {
        value: 134.5,
        unit: "cm",
        dt: 1785844800000,
        classification: "RiverApp",
      },
      discharge: { value: null, unit: "m3/s", dt: null },
      thresholds: {
        hw1: { value: null, unit: "cm", dt: null },
        hw30: { value: null, unit: "cm", dt: null },
      },
      statistics: {
        hhq: { value: null, unit: "m3/s", dt: null },
        nnq: { value: null, unit: "m3/s", dt: null },
        nqt: { value: null, unit: "m3/s", dt: null },
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

function formatTrimCm(value: number | null, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${formatNumber(value, value % 1 === 0 ? 0 : 1)} cm`;
  }

  return fallback || "n/a";
}

function formatTrimRange(suggestion: TrimSuggestion) {
  if (suggestion.trimCm === null) return "n/a";
  if (suggestion.minCm === null || suggestion.maxCm === null) {
    return `${formatNumber(suggestion.trimCm, 1)} cm`;
  }

  const hasRange = Math.abs(suggestion.maxCm - suggestion.minCm) >= 0.2;
  return hasRange
    ? `${formatNumber(suggestion.trimCm, 1)} cm · ${formatNumber(
        suggestion.minCm,
        1,
      )}-${formatNumber(suggestion.maxCm, 1)} cm`
    : `${formatNumber(suggestion.trimCm, 1)} cm`;
}

function formatSignedNumber(value: number | null, digits = 2) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatCorrelation(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return formatNumber(value, 2);
}

function correlationHint(value: number | null, count = 0) {
  if (count < 3 || value === null || Number.isNaN(value)) return "zu wenig Daten";
  const strength = Math.abs(value);
  if (strength >= 0.75) return value > 0 ? "stark gemeinsam" : "stark gegenläufig";
  if (strength >= 0.45) return value > 0 ? "mittel gemeinsam" : "mittel gegenläufig";
  return "schwach";
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

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, select, textarea, a, label"))
  );
}

function isChartInteractionTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".forecast-chart"));
}

function isInChartSideGutter(node: HTMLElement, clientX: number) {
  const rect = node.getBoundingClientRect();
  const gutter = clamp(rect.width * 0.08, 18, 36);
  return clientX - rect.left < gutter || rect.right - clientX < gutter;
}

function touchCenterX(touches: TouchList) {
  return Array.from(touches).reduce((sum, touch) => sum + touch.clientX, 0) / touches.length;
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

function emptySetupForm(loggedAt = formatDateTimeInput(platformSetupChangeAt)): PlatformSetupFormState {
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

function setupFormFromLog(log: PlatformSetupLog): PlatformSetupFormState {
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

function emptyObservationForm(observedAt = formatDateTimeInput(Date.now())): ObservationFormState {
  return {
    observedAt,
    trimCm: "",
    quality: 3.0,
    note: "",
  };
}

function observationFormFromObservation(
  observation: SurfObservation,
): ObservationFormState {
  return {
    observedAt: formatDateTimeInput(observation.observedAt),
    trimCm:
      observation.trimCm === null
        ? ""
        : String(Math.round(observation.trimCm * 10) / 10),
    quality: observation.quality,
    note: observation.note ?? "",
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
  const deltaScore = clamp(50 + delta * 14);
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

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numericValues(values: Array<number | null>) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function sessionReportDescription(
  averageQuality: number | null,
  observationCount: number,
  averageDelta: number | null,
) {
  if (!observationCount || averageQuality === null) {
    return "Für diesen Zeitraum liegen noch keine Wellenmeisterwerte vor.";
  }

  const quality =
    averageQuality >= 4
      ? "überwiegend gute"
      : averageQuality >= 3
        ? "brauchbare bis gemischte"
        : "eher schwierige";
  const delta =
    averageDelta === null
      ? "Das Delta konnte nicht stabil bewertet werden."
      : averageDelta >= 0.4
        ? "Das Delta war im Mittel positiv."
        : averageDelta <= -0.4
          ? "Das Delta war im Mittel negativ."
          : "Das Delta lag nahe am Nullbereich.";

  return `${observationCount} Wellenmeisterwerte zeigen ${quality} Bedingungen. ${delta}`;
}

function buildReportSessions(observations: SurfObservation[]): ReportSessionOption[] {
  const sorted = observations
    .filter(isRealObservation)
    .sort((a, b) => a.observedAt - b.observedAt);
  const groups: SurfObservation[][] = [];
  let current: SurfObservation[] = [];

  for (const observation of sorted) {
    const previous = current[current.length - 1];
    if (previous && observation.observedAt - previous.observedAt > reportSessionGapMs) {
      groups.push(current);
      current = [];
    }
    current.push(observation);
  }

  if (current.length) groups.push(current);

  return groups
    .map((group) => {
      const start = group[0].observedAt;
      const end = group[group.length - 1].observedAt;
      return {
        id: `${start}-${end}-${group.length}`,
        label: `${formatDate(start)} - ${formatTime(end)} · ${group.length} Werte`,
        start,
        end,
        count: group.length,
      };
    })
    .sort((a, b) => b.start - a.start);
}

function buildSessionReport(
  observations: SurfObservation[],
  history: HistoryPoint[],
  reportDomain: TimeDomain,
  sessionDomain = reportDomain,
  sessionLabel = "Manueller Zeitraum",
): SessionReport {
  const entries = sortSurfObservations(
    observations.filter(
      (observation) =>
        observation.observedAt >= sessionDomain.min &&
        observation.observedAt <= sessionDomain.max &&
        isRealObservation(observation),
    ),
  );
  const ascendingEntries = [...entries].reverse();
  const visibleHistory = history.filter(
    (point) => point.t >= reportDomain.min && point.t <= reportDomain.max,
  );
  const observationFeatures = entries.map(observationDataFeatures);
  const trimValues = numericValues(entries.map((entry) => entry.trimCm));
  const averageQuality = average(entries.map((entry) => entry.quality));
  const averageUpstream =
    average(numericValues(observationFeatures.map((feature) => feature.upstream))) ??
    average(
      visibleHistory
        .map((point) =>
          point.kroessbach === null && point.puig === null
            ? null
            : (point.kroessbach ?? 0) + (point.puig ?? 0),
        )
        .filter((value): value is number => value !== null),
    );
  const averageReichenau =
    average(numericValues(entries.map((entry) => entry.reichenauDischarge))) ??
    average(numericValues(visibleHistory.map((point) => point.reichenau)));
  const averageLevel =
    average(numericValues(entries.map((entry) => entry.reichenauLevel))) ??
    average(numericValues(visibleHistory.map((point) => point.reichenauLevel)));
  const averageDelta =
    average(numericValues(observationFeatures.map((feature) => feature.delta))) ??
    (averageReichenau !== null && averageUpstream !== null
      ? averageReichenau - averageUpstream
      : null);
  const bestObservation = entries.reduce<SurfObservation | null>(
    (best, entry) => (!best || entry.quality > best.quality ? entry : best),
    null,
  );
  const notes = ascendingEntries
    .map((entry) => {
      const note = entry.note?.replace(/\s+/g, " ").trim() ?? "";
      return note ? `${formatTime(entry.observedAt)} · ${note}` : "";
    })
    .filter(Boolean)
    .slice(0, 8);

  return {
    timeDomain: reportDomain,
    sessionDomain,
    rangeLabel: `${formatDate(reportDomain.min)} - ${formatDate(reportDomain.max)}`,
    sessionLabel,
    generatedAt: Date.now(),
    observationCount: entries.length,
    averageQuality,
    bestObservation,
    averageTrim: average(trimValues),
    trimMin: trimValues.length ? Math.min(...trimValues) : null,
    trimMax: trimValues.length ? Math.max(...trimValues) : null,
    averageUpstream,
    averageReichenau,
    averageLevel,
    averageDelta,
    description: sessionReportDescription(averageQuality, entries.length, averageDelta),
    notes,
    entries: ascendingEntries.slice(-10),
  };
}

function percentile(values: number[], ratio: number) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];

  const position = clamp(ratio, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const mix = position - lower;
  return sorted[lower] * (1 - mix) + sorted[upper] * mix;
}

function rangeFromValues(
  values: number[],
  fallbackMin: number,
  fallbackMax: number,
  minWidth: number,
) {
  const low = percentile(values, 0.2);
  const high = percentile(values, 0.8);

  if (low === null || high === null) {
    return { min: fallbackMin, max: fallbackMax };
  }

  const center = (low + high) / 2;
  const width = Math.max(minWidth, high - low);
  return {
    min: center - width / 2,
    max: center + width / 2,
  };
}

function learnedExperienceTargets(
  observations: SurfObservation[],
  referenceTime: number,
): ExperienceTargets {
  const rated = observations.filter(isRealObservation);
  const targetIsNewSetup = referenceTime >= platformSetupChangeAt;
  const good = rated.filter((observation) => observation.quality >= 4);
  const sameSetupGood = good.filter((observation) =>
    targetIsNewSetup
      ? observation.observedAt >= platformSetupChangeAt
      : observation.observedAt < platformSetupChangeAt,
  );
  const basis =
    sameSetupGood.length >= 3
      ? sameSetupGood
      : good.length >= 3
        ? good
        : [];

  if (!basis.length) return fallbackExperienceTargets;

  const flowValues = basis
    .map((observation) => observationDataFeatures(observation).upstream)
    .filter((value): value is number => value !== null);
  const levelValues = basis
    .map((observation) => observation.reichenauLevel)
    .filter((value): value is number => value !== null);
  const flowRange = rangeFromValues(
    flowValues,
    fallbackExperienceTargets.flowMin,
    fallbackExperienceTargets.flowMax,
    2,
  );
  const levelRange = rangeFromValues(
    levelValues,
    fallbackExperienceTargets.levelMin,
    fallbackExperienceTargets.levelMax,
    6,
  );
  const hasCurrentSetup = sameSetupGood.length >= 3;
  const dataCompleteness = Math.min(flowValues.length, levelValues.length);
  const confidence = Math.round(
    clamp(
      (Math.min(basis.length / 12, 1) * 0.55 +
        Math.min(dataCompleteness / 8, 1) * 0.45) *
        (hasCurrentSetup ? 1 : 0.55),
      0,
      1,
    ) * 100,
  );

  return {
    flowMin: Math.max(0, flowRange.min),
    flowMax: Math.max(flowRange.max, flowRange.min + 0.5),
    levelMin: Math.max(0, levelRange.min),
    levelMax: Math.max(levelRange.max, levelRange.min + 1),
    sampleSize: basis.length,
    sameSetupCount: sameSetupGood.length,
    confidence,
    basis: hasCurrentSetup ? "aktuelles Setup" : "alle Setups",
  };
}

function spotInsightStats(observations: SurfObservation[]): SpotInsightStats {
  const real = observations.filter(isRealObservation);
  const good = real.filter((observation) => observation.quality >= 4);
  const critical = real.filter((observation) => observation.quality <= 2.5);
  const linked = real.filter((observation) => {
    const features = observationDataFeatures(observation);
    return (
      features.upstream !== null ||
      features.level !== null ||
      features.reichenau !== null
    );
  });
  const goodDeltas = good
    .map((observation) => observationDataFeatures(observation).delta)
    .filter((value): value is number => value !== null);
  const goodTrims = good
    .map((observation) => observation.trimCm)
    .filter((value): value is number => value !== null);
  const levelFlowPairs = real
    .filter(
      (observation) =>
        observation.reichenauLevel !== null &&
        observation.reichenauDischarge !== null,
    )
    .map((observation) => ({
      x: observation.reichenauLevel ?? 0,
      y: observation.reichenauDischarge ?? 0,
    }));
  const targetLevelFlowPairs = good
    .filter(
      (observation) =>
        observation.reichenauLevel !== null &&
        observation.reichenauDischarge !== null,
    )
    .map((observation) => ({
      x: observation.reichenauLevel ?? 0,
      y: observation.reichenauDischarge ?? 0,
    }));

  return {
    total: real.length,
    linked: linked.length,
    good: good.length,
    critical: critical.length,
    averageGoodQuality: average(good.map((observation) => observation.quality)),
    averageGoodTrim: average(goodTrims),
    goodDeltaAverage: average(goodDeltas),
    levelFlowCorrelation: pearsonCorrelation(levelFlowPairs),
    levelFlowCount: levelFlowPairs.length,
    targetLevelFlowCorrelation: pearsonCorrelation(targetLevelFlowPairs),
    targetCorrelationCount: targetLevelFlowPairs.length,
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

function weightedAverage(
  entries: Array<{ value: number; weight: number }>,
) {
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightSum <= 0) return null;
  return (
    entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / weightSum
  );
}

function trimSuggestionSignal(
  observations: SurfObservation[],
  target: {
    time: number;
    delta: number;
    upstream: number;
    level: number | null;
    reichenau: number | null;
  },
): TrimSuggestion {
  const rated = observations
    .filter(isRealObservation)
    .filter((observation) => observation.trimCm !== null)
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
      trimCm: null,
      minCm: null,
      maxCm: null,
      confidence: 0,
      sampleSize: 0,
      matchedCount: 0,
      basis: "zu wenig Daten",
      note: "Noch keine Trimwerte mit passenden Messdaten.",
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
  const good = weighted.filter((entry) => entry.observation.quality >= 3.5);
  const usable = good.length >= 2 ? good : weighted;
  const trimWeights = usable
    .map((entry) => {
      const trimCm = entry.observation.trimCm;
      if (trimCm === null) return null;
      const qualityWeight = clamp((entry.observation.quality - 1) / 4, 0.2, 1);
      return {
        value: trimCm,
        weight: entry.similarity * qualityWeight,
      };
    })
    .filter((entry): entry is { value: number; weight: number } => entry !== null);
  const trimCm = weightedAverage(trimWeights);

  if (trimCm === null) {
    return {
      trimCm: null,
      minCm: null,
      maxCm: null,
      confidence: 0,
      sampleSize: basis.length,
      matchedCount: weighted.length,
      basis: "zu wenig Daten",
      note: "Ähnliche Punkte haben keinen verwertbaren Trimwert.",
    };
  }

  const trimValues = trimWeights.map((entry) => entry.value);
  const minCm = Math.min(...trimValues);
  const maxCm = Math.max(...trimValues);
  const weightSum = trimWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const setupPenalty = targetIsNewSetup && !useSameSetup ? 0.55 : 1;
  const successPenalty = good.length >= 2 ? 1 : 0.65;
  const confidence = Math.round(
    clamp(
      (Math.min(basis.length / 12, 1) * 0.4 +
        Math.min(weighted.length / 6, 1) * 0.25 +
        Math.min(weightSum / 3, 1) * 0.35) *
        setupPenalty *
        successPenalty,
      0,
      1,
    ) * 100,
  );

  return {
    trimCm,
    minCm,
    maxCm,
    confidence,
    sampleSize: basis.length,
    matchedCount: weighted.length,
    basis: good.length >= 2 ? "gute ähnliche Werte" : "ähnliche Werte",
    note:
      targetIsNewSetup && !useSameSetup
        ? "BETA: neues Setup hat noch wenig eigene Trimdaten."
        : good.length >= 2
          ? "BETA: aus guten ähnlichen Wellenmeisterwerten."
          : "BETA: aus ähnlichen Werten, noch wenig gute Treffer.",
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
    gaerberbachLevel: valueOrNull(stations[gaerberbachStationId]?.water.value),
  };

  if (
    point.kroessbach === null &&
    point.puig === null &&
    point.reichenau === null &&
    point.kroessbachLevel === null &&
    point.puigLevel === null &&
    point.reichenauLevel === null &&
    point.gaerberbachLevel === null
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
        gaerberbachLevel: valueOrNull(point.gaerberbachLevel),
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
    const t = point.t;
    byStationAndTime.set(`${point.stationId}:${t}`, { ...point, t });
  }

  return [...byStationAndTime.values()]
    .sort((a, b) => a.t - b.t || a.stationId.localeCompare(b.stationId))
    .slice(-maxPoints);
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
  const forecastHorizon = 6 * 60 * 60 * 1000;
  const max = Math.max(newest + sampleInterval, newest + forecastHorizon);

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
    rolling30: rollingVolumeBalanceSeries(points, 30 * 60 * 1000),
    rolling60: rollingVolumeBalanceSeries(points),
    rolling120: rollingVolumeBalanceSeries(points, 120 * 60 * 1000),
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
      const value = point[key];
      if (value !== null && Number.isFinite(value)) return value;
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
    if (history[index].t <= t) {
      const value = history[index][key];
      if (value !== null && Number.isFinite(value)) return value;
    }
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

function runtimeComparisonPoints(
  history: HistoryPoint[],
  lagKroessbach: number,
  lagPuig: number,
  timeDomain: TimeDomain,
  maxPoints?: number,
) {
  const maxAgeMs = sampleInterval * 3;
  const base = history
    .filter(
      (point) =>
        point.t >= timeDomain.min &&
        point.t <= timeDomain.max &&
        point.reichenau !== null,
    )
    .slice(maxPoints ? -maxPoints : 0);

  return base
    .map((point) => {
      const shifted = shiftedUpstreamAt(
        history,
        point.t,
        lagKroessbach,
        lagPuig,
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
}

function runtimePointStats(points: RuntimeComparisonPoint[]) {
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

function runtimeRecommendation(
  history: HistoryPoint[],
  timeDomain: TimeDomain,
): RuntimeRecommendation | null {
  const minuteRange = (min: number, max: number, step: number) =>
    Array.from(
      { length: Math.floor((max - min) / step) + 1 },
      (_, index) => min + index * step,
    );
  const kroessbachCandidates = minuteRange(60, 180, 5);
  const puigCandidates = minuteRange(45, 150, 5);
  let best:
    | (RuntimeRecommendation & {
        score: number;
      })
    | null = null;

  for (const lagKroessbach of kroessbachCandidates) {
    for (const lagPuig of puigCandidates) {
      const points = runtimeComparisonPoints(
        history,
        lagKroessbach,
        lagPuig,
        timeDomain,
        160,
      );
      if (points.length < 8) continue;

      const stats = runtimePointStats(points);
      const correlation = stats.correlation ?? -1;
      const meanAbsoluteDelta = stats.meanAbsoluteDelta ?? 99;
      const score = correlation * 2 - Math.min(meanAbsoluteDelta / 8, 2);

      if (!best || score > best.score) {
        const positiveCorrelation = Math.max(0, correlation);
        const confidence = Math.round(
          clamp(
            (Math.min(points.length / 32, 1) * 0.3 +
              positiveCorrelation * 0.5 +
              (1 - Math.min(meanAbsoluteDelta / 6, 1)) * 0.2) *
              100,
          ),
        );

        best = {
          lagKroessbach,
          lagPuig,
          correlation: stats.correlation,
          meanAbsoluteDelta: stats.meanAbsoluteDelta,
          count: points.length,
          confidence,
          score,
        };
      }
    }
  }

  if (!best) return null;

  return {
    lagKroessbach: best.lagKroessbach,
    lagPuig: best.lagPuig,
    correlation: best.correlation,
    meanAbsoluteDelta: best.meanAbsoluteDelta,
    count: best.count,
    confidence: best.confidence,
  };
}

function runtimeComparisonSummary(
  history: HistoryPoint[],
  settings: ForecastSettings,
  timeDomain: TimeDomain,
): RuntimeComparisonSummary {
  const points = runtimeComparisonPoints(
    history,
    settings.lagKroessbach,
    settings.lagPuig,
    timeDomain,
  );
  const stats = runtimePointStats(points);
  const recommendation = runtimeRecommendation(history, timeDomain);

  if (!points.length) {
    return {
      count: 0,
      correlation: null,
      kroessbachCorrelation: null,
      puigCorrelation: null,
      meanDelta: null,
      meanAbsoluteDelta: null,
      latest: null,
      recommendation,
    };
  }

  return {
    ...stats,
    recommendation,
  };
}

export default function Home() {
  const [payload, setPayload] = useState<HydroPayload>(fallbackPayload);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  const [reportMode, setReportMode] = useState<"session" | "custom">("session");
  const [reportSessionId, setReportSessionId] = useState("latest");
  const [reportCustomFrom, setReportCustomFrom] = useState("");
  const [reportCustomTo, setReportCustomTo] = useState("");
  const chartNavigatorRef = useRef<HTMLDivElement | null>(null);
  const chartInteractionRef = useRef({
    canMoveTimeAxis: false,
    hasZoomableTimeAxis: false,
    timeZoom: defaultTimeZoom,
  });
  const [observations, setObservations] = useState<SurfObservation[]>([]);
  const [observationForm, setObservationForm] = useState<ObservationFormState>(() =>
    emptyObservationForm(),
  );
  const [editingObservationId, setEditingObservationId] = useState<number | null>(
    null,
  );
  const [observationEditForm, setObservationEditForm] =
    useState<ObservationFormState | null>(null);
  const [observationSaving, setObservationSaving] = useState(false);
  const [deletingObservationId, setDeletingObservationId] = useState<number | null>(
    null,
  );
  const [observationMessage, setObservationMessage] = useState("");
  const [setupLogs, setSetupLogs] = useState<PlatformSetupLog[]>([]);
  const [setupForm, setSetupForm] = useState(() => emptySetupForm());
  const [editingSetupId, setEditingSetupId] = useState<number | null>(null);
  const [setupEditForm, setSetupEditForm] =
    useState<PlatformSetupFormState | null>(null);
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
        `/api/surf-observations?hours=${Math.ceil(
          Math.max(observationLearningHours, historyHours),
        )}`,
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
        forecast: compactWeatherHistory(data.forecast ?? []),
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

  async function saveSetupForm(form: PlatformSetupFormState, id: number | null) {
    const loggedAt = parseDateTimeInput(form.loggedAt);

    if (loggedAt === null) {
      setSetupMessage("Bitte Datum und Uhrzeit eintragen.");
      return;
    }

    setSetupSaving(true);
    try {
      const isEditing = id !== null;
      const response = await fetch("/api/platform-setup", {
        method: isEditing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          loggedAt,
          waveMaster: form.waveMaster,
          chainLeftCm: form.chainLeftCm,
          chainRightCm: form.chainRightCm,
          rampPosition: form.rampPosition,
          trimHeightCm: form.trimHeightCm,
          tensionLeft: form.tensionLeft,
          tensionRight: form.tensionRight,
          waterLevelCm: form.waterLevelCm,
          dischargeCms: form.dischargeCms,
          note: form.note,
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
      setSetupEditForm(null);
      if (!isEditing) {
        setSetupForm(emptySetupForm(form.loggedAt));
      }
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

  async function submitSetupLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupMessage("");
    await saveSetupForm(setupForm, null);
  }

  async function submitSetupEdit(id: number, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupMessage("");
    if (!setupEditForm) {
      setSetupMessage("Kein Setup-Wert zum Bearbeiten ausgewählt.");
      return;
    }
    await saveSetupForm(setupEditForm, id);
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
    setSetupEditForm(setupFormFromLog(log));
    setSetupMessage("Setup-Wert direkt in der Liste bearbeiten.");
  }

  function cancelSetupEdit() {
    setEditingSetupId(null);
    setSetupEditForm(null);
    setSetupMessage("");
  }

  async function saveObservationForm(form: ObservationFormState, id: number | null) {
    const trimCm = Number(form.trimCm);
    const observedAt = parseDateTimeInput(form.observedAt);

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
      const isEditing = id !== null;
      const response = await fetch("/api/surf-observations", {
        method: isEditing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          observedAt,
          trimCm,
          quality: form.quality,
          note: form.note,
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
      setObservationEditForm(null);
      if (!isEditing) {
        setObservationForm((current) => ({
          ...current,
          observedAt: formatDateTimeInput(observedAt + 30 * 60 * 1000),
          trimCm: "",
          note: "",
        }));
      }
      setObservationMessage(isEditing ? "Eintrag aktualisiert." : "Gespeichert.");
    } catch (err) {
      setObservationMessage(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setObservationSaving(false);
    }
  }

  async function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setObservationMessage("");
    await saveObservationForm(observationForm, null);
  }

  async function submitObservationEdit(
    id: number,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setObservationMessage("");
    if (!observationEditForm) {
      setObservationMessage("Kein Eintrag zum Bearbeiten ausgewählt.");
      return;
    }
    await saveObservationForm(observationEditForm, id);
  }

  function editObservation(observation: SurfObservation) {
    setEditingObservationId(observation.id);
    setObservationEditForm(observationFormFromObservation(observation));
    setObservationMessage("Eintrag direkt in der Liste bearbeiten.");
  }

  function cancelObservationEdit() {
    setEditingObservationId(null);
    setObservationEditForm(null);
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
  const reportSessions = useMemo(
    () => buildReportSessions(observations),
    [observations],
  );
  const selectedReportSession =
    reportSessions.find((session) => session.id === reportSessionId) ??
    reportSessions[0] ??
    null;
  const customReportFrom =
    parseDateTimeInput(reportCustomFrom || formatDateTimeInput(chartTimeDomain.min)) ??
    chartTimeDomain.min;
  const customReportTo =
    parseDateTimeInput(reportCustomTo || formatDateTimeInput(chartTimeDomain.max)) ??
    chartTimeDomain.max;
  const reportSelection = useMemo(() => {
    const customReportDomain = {
      min: Math.min(customReportFrom, customReportTo),
      max: Math.max(customReportFrom, customReportTo),
    };

    if (reportMode === "session" && selectedReportSession) {
      return {
        timeDomain: {
          min: selectedReportSession.start - reportContextMs,
          max: selectedReportSession.end + reportContextMs,
        },
        sessionDomain: {
          min: selectedReportSession.start,
          max: selectedReportSession.end,
        },
        label: selectedReportSession.label,
      };
    }

    return {
      timeDomain: customReportDomain,
      sessionDomain: customReportDomain,
      label: "Manueller Zeitraum",
    };
  }, [customReportFrom, customReportTo, reportMode, selectedReportSession]);
  const sessionReport = useMemo(
    () =>
      buildSessionReport(
        observations,
        forecastHistory,
        reportSelection.timeDomain,
        reportSelection.sessionDomain,
        reportSelection.label,
      ),
    [observations, forecastHistory, reportSelection],
  );
  const waveLagKroessbach = Math.max(
    0,
    forecastSettings.lagKroessbach - forecastSettings.waveOffset,
  );
  const waveLagPuig = Math.max(
    0,
    forecastSettings.lagPuig - forecastSettings.waveOffset,
  );
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
  const visibleWeatherForecast = (weatherPayload.forecast ?? []).filter(
    (point) => point.t >= chartTimeDomain.min && point.t <= chartTimeDomain.max,
  );
  const waveInflowTrend = inflowTrendAt(
    forecastHistory,
    waveTime,
    waveLagKroessbach,
    waveLagPuig,
  );
  const levelAtWave =
    latestAt(forecastHistory, waveTime, "reichenauLevel") ??
    valueOrNull(reichenau?.water.value);
  const experienceTargets = learnedExperienceTargets(observations, waveTime);
  const insightStats = spotInsightStats(observations);
  const qualityNowModelScore = waveQualityScore(
    expectedWaveDelta,
    upstreamAtWave,
    levelAtWave,
    experienceTargets.flowMin,
    experienceTargets.flowMax,
    experienceTargets.levelMin,
    experienceTargets.levelMax,
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
  const trimSuggestionNow = trimSuggestionSignal(observations, {
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
    trimSuggestion: trimSuggestionNow,
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
        experienceTargets.flowMin,
        experienceTargets.flowMax,
        experienceTargets.levelMin,
        experienceTargets.levelMax,
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
      const trimSuggestion = trimSuggestionSignal(observations, {
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
        trimSuggestion,
        score: blendManualQuality(dataScore, manual, point.t),
      };
    });
  const qualityTimeline = [...qualityCandidates, qualityNow]
    .sort((a, b) => a.time - b.time)
    .filter(
      (point, index, points) =>
        index === 0 || Math.abs(point.time - points[index - 1].time) > 60 * 1000,
    );
  const runtimeComparison = runtimeComparisonSummary(
    forecastHistory,
    forecastSettings,
    chartTimeDomain,
  );
  const runtimeRecommendationHint = runtimeComparison.recommendation;
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
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return undefined;
    }
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
          startY: number;
          startPosition: number;
          active: boolean;
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
      if (!isChartInteractionTarget(event.target)) return;
      if (!interaction.hasZoomableTimeAxis) return;

      event.preventDefault();
      event.stopPropagation();

      const deltaX = event.deltaX + (event.shiftKey ? event.deltaY : 0);
      const horizontalScroll = Math.abs(deltaX) > Math.abs(event.deltaY);

      if (horizontalScroll && interaction.canMoveTimeAxis) {
        setTimeZoom((current) => ({
          ...current,
          position: clamp(
            current.position + deltaX * chartHorizontalWheelSensitivity,
            0,
            100,
          ),
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
      if (!isChartInteractionTarget(event.target)) return;
      if (!interaction.hasZoomableTimeAxis) return;

      if (event.touches.length >= 2) {
        if (isInChartSideGutter(node, touchCenterX(event.touches))) return;
        event.preventDefault();
        touchGesture = {
          mode: "pinch",
          startDistance: Math.max(1, touchDistance(event.touches)),
          startDetail: interaction.timeZoom.detail,
        };
        return;
      }

      if (event.touches.length === 1 && interaction.canMoveTimeAxis) {
        const touch = event.touches[0];
        if (isInChartSideGutter(node, touch.clientX)) return;
        touchGesture = {
          mode: "pan",
          startX: touch.clientX,
          startY: touch.clientY,
          startPosition: interaction.timeZoom.position,
          active: false,
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
        const touch = event.touches[0];
        const dx = touch.clientX - touchGesture.startX;
        const dy = touch.clientY - touchGesture.startY;

        if (!touchGesture.active) {
          const clearHorizontalIntent =
            Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;
          const clearVerticalIntent = Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx);

          if (clearVerticalIntent) {
            touchGesture = null;
            return;
          }

          if (!clearHorizontalIntent) return;

          touchGesture = {
            ...touchGesture,
            active: true,
          };
        }

        event.preventDefault();
        event.stopPropagation();
        const width = Math.max(1, node.clientWidth);
        const deltaPercent =
          ((touchGesture.startX - touch.clientX) / width) *
          100 *
          chartHorizontalDragSensitivity;

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
    if (!isChartInteractionTarget(event.target)) return;
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
    const deltaPercent =
      ((timeDrag.x - event.clientX) / width) * 100 * chartHorizontalDragSensitivity;

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
            {/* eslint-disable-next-line @next/next/no-img-element -- small static worker asset */}
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
        </div>
        <div className="quality-grid">
          <WaveQualityCard title="Jetzt" quality={qualityNow} />
          <WaveQualityScale projections={qualityTimeline} />
        </div>
      </section>

      <SpotInsightSection
        stats={insightStats}
        targets={experienceTargets}
      />

      <SessionReportSection
        report={sessionReport}
        sessions={reportSessions}
        mode={reportMode}
        selectedSessionId={selectedReportSession?.id ?? "latest"}
        customFrom={reportCustomFrom || formatDateTimeInput(chartTimeDomain.min)}
        customTo={reportCustomTo || formatDateTimeInput(chartTimeDomain.max)}
        history={forecastHistory}
        delta={deltaLine}
        onModeChange={setReportMode}
        onSessionChange={setReportSessionId}
        onCustomFromChange={setReportCustomFrom}
        onCustomToChange={setReportCustomTo}
      />

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
            <div
              className="runtime-inline-controls"
              aria-label="Forecast Laufzeiten"
              onPointerDown={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              <div className="runtime-inline-head">
                <div>
                  <span>Laufzeiten</span>
                  <strong>Forecast feinjustieren</strong>
                </div>
                <dl className="arrival-list compact">
                  <div>
                    <dt>Krössbach sichtbar</dt>
                    <dd>{formatTime(forecastArrivalKroessbach)}</dd>
                  </div>
                  <div>
                    <dt>Puig sichtbar</dt>
                    <dd>{formatTime(forecastArrivalPuig)}</dd>
                  </div>
                </dl>
              </div>
              <div className="runtime-inline-recommendation">
                <div>
                  <span>Empfohlene Einstellung</span>
                  <strong>
                    {runtimeRecommendationHint
                      ? `${runtimeRecommendationHint.lagKroessbach} / ${runtimeRecommendationHint.lagPuig} min`
                      : "noch zu wenig Daten"}
                  </strong>
                  <small>
                    {runtimeRecommendationHint
                      ? `Krössbach / Puig · ${runtimeRecommendationHint.confidence} % Sicherheit · ${runtimeRecommendationHint.count} Vergleiche`
                      : "Sobald genug Vergleichspunkte sichtbar sind, erscheint hier ein Vorschlag."}
                  </small>
                </div>
                <p>
                  Der Vorschlag zeigt, welche Laufzeiten im sichtbaren Zeitraum
                  am besten zu Reichenau passen. Er hilft beim Feintunen der
                  Regler, wird aber nicht automatisch übernommen.
                </p>
              </div>
              <div className="runtime-inline-grid">
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
              </div>
            </div>
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
                <ObservationSection
                  observations={observations}
                  observationForm={observationForm}
                  setObservationForm={setObservationForm}
                  submitObservation={submitObservation}
                  observationSaving={observationSaving}
                  editingObservationId={editingObservationId}
                  observationEditForm={observationEditForm}
                  setObservationEditForm={setObservationEditForm}
                  submitObservationEdit={submitObservationEdit}
                  cancelObservationEdit={cancelObservationEdit}
                  observationMessage={observationMessage}
                  editObservation={editObservation}
                  deleteObservation={deleteObservation}
                  deletingObservationId={deletingObservationId}
                />
                <SurfForecastChart
                  history={forecastHistory}
                  forecast={forecastLine}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  surfMin={Math.min(experienceTargets.flowMin, experienceTargets.flowMax)}
                  surfMax={Math.max(experienceTargets.flowMin, experienceTargets.flowMax)}
                  observations={observations}
                  timeControl={
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
                  }
                />
                <SurfLevelChart
                  history={forecastHistory}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  levelMin={Math.min(experienceTargets.levelMin, experienceTargets.levelMax)}
                  levelMax={Math.max(experienceTargets.levelMin, experienceTargets.levelMax)}
                  observations={observations}
                />
                <SurfDeltaChart
                  delta={deltaLine}
                  timeDomain={chartTimeDomain}
                  markerTime={waveTime}
                />
                <RainfallSection
                  weather={weatherPayload}
                  visiblePoints={visibleWeatherPoints}
                  visibleForecast={visibleWeatherForecast}
                  timeDomain={chartTimeDomain}
                  markerTime={lastMeasurementTime}
                  error={weatherError}
                />
                <SurfVolumeBalanceChart
                  balance30Series={volumeBalance.rolling30}
                  balance60Series={volumeBalance.rolling60}
                  balance120Series={volumeBalance.rolling120}
                  timeDomain={chartTimeDomain}
                  markerTime={waveTime}
                  balance30={volumeBalance.balance30}
                  balance60={volumeBalance.balance60}
                  balance120={volumeBalance.balance120}
                />
              </div>
            </div>

          </div>
        </div>

        <RuntimeCorrelationPanel
          summary={runtimeComparison}
          kroessbachRuntime={kr?.waveRuntime}
          puigRuntime={puig?.waveRuntime}
          settings={forecastSettings}
        />
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
        setupEditForm={setupEditForm}
        setSetupEditForm={setSetupEditForm}
        setupMessage={setupMessage}
        editingSetupId={editingSetupId}
        setupSaving={setupSaving}
        deletingSetupId={deletingSetupId}
        onFormChange={setSetupForm}
        onSubmit={submitSetupLog}
        onSubmitEdit={submitSetupEdit}
        onEdit={editSetupLog}
        onCancelEdit={cancelSetupEdit}
        onDelete={deleteSetupLog}
      />

      <footer className="source-line">
        Version 0.83.260812 · Autor: Kilian Zotz · Quelle: {payload.source} + GeoSphere
        Austria. Messstellen: 202283, 201574, 201624, RiverApp Gärberbach.
      </footer>
    </main>
  );
}

function SessionReportSection({
  report,
  sessions,
  mode,
  selectedSessionId,
  customFrom,
  customTo,
  history,
  delta,
  onModeChange,
  onSessionChange,
  onCustomFromChange,
  onCustomToChange,
}: {
  report: SessionReport;
  sessions: ReportSessionOption[];
  mode: "session" | "custom";
  selectedSessionId: string;
  customFrom: string;
  customTo: string;
  history: HistoryPoint[];
  delta: { t: number; value: number | null }[];
  onModeChange: Dispatch<SetStateAction<"session" | "custom">>;
  onSessionChange: Dispatch<SetStateAction<string>>;
  onCustomFromChange: Dispatch<SetStateAction<string>>;
  onCustomToChange: Dispatch<SetStateAction<string>>;
}) {
  const trimRange =
    report.trimMin === null || report.trimMax === null
      ? "n/a"
      : `${formatNumber(report.trimMin, 1)}-${formatNumber(report.trimMax, 1)} cm`;
  const bestLabel = report.bestObservation
    ? `${formatQuality(report.bestObservation.quality)}/5 · ${formatTime(
        report.bestObservation.observedAt,
      )}`
    : "n/a";

  return (
    <section className="session-report-section" aria-label="Sessionreport">
      <div className="section-heading report-heading">
        <div>
          <p>Sessionreport</p>
          <h2>Wellenverhältnisse kompakt</h2>
        </div>
        <div className="report-actions">
          <button type="button" onClick={() => window.print()}>
            PDF exportieren
          </button>
        </div>
      </div>

      <div className="report-controls" aria-label="Report Zeitraum einstellen">
        <label>
          <span>Report</span>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as "session" | "custom")}
          >
            <option value="session">automatisch aus Sessionwerten</option>
            <option value="custom">eigener Zeitraum</option>
          </select>
        </label>
        {mode === "session" ? (
          <label>
            <span>Session</span>
            <select
              value={selectedSessionId}
              onChange={(event) => onSessionChange(event.target.value)}
              disabled={!sessions.length}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label}
                </option>
              ))}
              {!sessions.length ? <option>keine Sessionwerte</option> : null}
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>Von</span>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(event) => onCustomFromChange(event.target.value)}
              />
            </label>
            <label>
              <span>Bis</span>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(event) => onCustomToChange(event.target.value)}
              />
            </label>
          </>
        )}
      </div>

      <div className="report-print-header">
        <strong>SILLVIA Forecast · Sessionreport</strong>
        <span>{report.sessionLabel}</span>
      </div>

      <div className="report-summary">
        <p>{report.description}</p>
        <dl>
          <div>
            <dt>Reportfenster</dt>
            <dd>{report.rangeLabel}</dd>
          </div>
          <div>
            <dt>Wertungen</dt>
            <dd>{report.observationCount}</dd>
          </div>
          <div>
            <dt>Ø Welle</dt>
            <dd>
              {report.averageQuality === null
                ? "n/a"
                : `${formatQuality(report.averageQuality)}/5`}
            </dd>
          </div>
          <div>
            <dt>Beste Wertung</dt>
            <dd>{bestLabel}</dd>
          </div>
          <div>
            <dt>Trim</dt>
            <dd>
              {report.averageTrim === null
                ? trimRange
                : `${formatNumber(report.averageTrim, 1)} cm Ø · ${trimRange}`}
            </dd>
          </div>
          <div>
            <dt>Reichenau</dt>
            <dd>
              {formatNumber(report.averageReichenau, 2)} m³/s ·{" "}
              {formatNumber(report.averageLevel, 1)} cm
            </dd>
          </div>
          <div>
            <dt>Zufluss K+P</dt>
            <dd>{formatNumber(report.averageUpstream, 2)} m³/s</dd>
          </div>
          <div>
            <dt>Ø Delta</dt>
            <dd>{formatSignedNumber(report.averageDelta, 2)} m³/s</dd>
          </div>
        </dl>
      </div>

      <SessionReportCharts report={report} history={history} delta={delta} />

      <div className="report-grid">
        <div>
          <h3>Wellenmeisterwerte</h3>
          <table>
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Welle</th>
                <th>Trim</th>
                <th>Reichenau</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatTime(entry.observedAt)}</td>
                  <td>{formatQuality(entry.quality)}/5</td>
                  <td>{formatTrimCm(entry.trimCm, entry.trim)}</td>
                  <td>
                    {formatNumber(entry.reichenauDischarge, 2)} m³/s ·{" "}
                    {formatNumber(entry.reichenauLevel, 1)} cm
                  </td>
                </tr>
              ))}
              {!report.entries.length ? (
                <tr>
                  <td colSpan={4}>Keine Wellenmeisterwerte im gewählten Zeitraum.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside>
          <h3>Vollständige Notizen</h3>
          {report.notes.length ? (
            <ul>
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p>Keine Notizen im gewählten Zeitraum.</p>
          )}
          <small>Erstellt: {formatDate(report.generatedAt)}</small>
        </aside>
      </div>
    </section>
  );
}

function SessionReportCharts({
  report,
  history,
  delta,
}: {
  report: SessionReport;
  history: HistoryPoint[];
  delta: { t: number; value: number | null }[];
}) {
  const inReport = (point: { t: number }) =>
    point.t >= report.timeDomain.min && point.t <= report.timeDomain.max;
  const mergeReportSeries = (
    historyPoints: { t: number; value: number | null }[],
    entryPoints: { t: number; value: number | null }[],
  ) => {
    const byTime = new Map<number, number | null>();

    for (const point of historyPoints) {
      byTime.set(point.t, point.value);
    }
    for (const point of entryPoints) {
      if (point.value !== null && Number.isFinite(point.value)) {
        byTime.set(point.t, point.value);
      }
    }

    return [...byTime.entries()]
      .map(([t, value]) => ({ t, value }))
      .sort((a, b) => a.t - b.t);
  };
  const upstreamFromHistory = history
    .filter(inReport)
    .map((point) => ({
      t: point.t,
      value:
        point.kroessbach === null && point.puig === null
          ? null
          : (point.kroessbach ?? 0) + (point.puig ?? 0),
    }));
  const upstreamFromEntries = report.entries.map((entry) => {
    const features = observationDataFeatures(entry);
    return {
      t: entry.observedAt,
      value: features.upstream,
    };
  });
  const upstream = mergeReportSeries(upstreamFromHistory, upstreamFromEntries);
  const reichenauFromHistory = history
    .filter(inReport)
    .map((point) => ({ t: point.t, value: point.reichenau }));
  const reichenauFromEntries = report.entries.map((entry) => ({
    t: entry.observedAt,
    value: entry.reichenauDischarge,
  }));
  const reichenau = mergeReportSeries(reichenauFromHistory, reichenauFromEntries);
  const levelFromHistory = history
    .filter(inReport)
    .map((point) => ({ t: point.t, value: point.reichenauLevel }));
  const levelFromEntries = report.entries.map((entry) => ({
    t: entry.observedAt,
    value: entry.reichenauLevel,
  }));
  const level = mergeReportSeries(levelFromHistory, levelFromEntries);
  const deltaFromEntries = report.entries.map((entry) => {
    const features = observationDataFeatures(entry);
    return {
      t: entry.observedAt,
      value: features.delta,
    };
  });
  const deltaPoints = mergeReportSeries(delta.filter(inReport), deltaFromEntries);
  const flowMarkers = report.entries.map((entry) => ({
    id: entry.id,
    t: entry.observedAt,
    value: entry.reichenauDischarge,
    label: formatQuality(entry.quality),
    quality: entry.quality,
  }));
  const levelMarkers = report.entries.map((entry) => ({
    id: entry.id,
    t: entry.observedAt,
    value: entry.reichenauLevel,
    label: formatQuality(entry.quality),
    quality: entry.quality,
  }));
  const deltaMarkers = report.entries.map((entry) => {
    const features = observationDataFeatures(entry);
    return {
      id: entry.id,
      t: entry.observedAt,
      value: features.delta,
      label: formatQuality(entry.quality),
      quality: entry.quality,
    };
  });
  const trimPoints = report.entries
    .map((entry) => ({ t: entry.observedAt, value: entry.trimCm }))
    .filter((point): point is { t: number; value: number } => point.value !== null);
  const trimMarkers = report.entries.map((entry) => ({
    id: entry.id,
    t: entry.observedAt,
    value: entry.trimCm,
    label: entry.trimCm === null ? "" : formatNumber(entry.trimCm, 1),
    quality: entry.quality,
  }));

  return (
    <div className="report-chart-stack">
      <ReportMiniChart
        title="Abfluss"
        unit="m³/s"
        timeDomain={report.timeDomain}
        sessionDomain={report.sessionDomain}
        series={[
          { label: "Zufluss K+P", className: "upstream", points: upstream },
          { label: "Reichenau", className: "reichenau", points: reichenau },
        ]}
        markers={flowMarkers}
      />
      <ReportMiniChart
        title="Pegel Reichenau"
        unit="cm"
        timeDomain={report.timeDomain}
        sessionDomain={report.sessionDomain}
        series={[{ label: "Pegel", className: "level", points: level }]}
        markers={levelMarkers}
      />
      <ReportMiniChart
        title="Delta Welle"
        unit="m³/s"
        timeDomain={report.timeDomain}
        sessionDomain={report.sessionDomain}
        zeroLine
        series={[{ label: "Delta", className: "delta", points: deltaPoints }]}
        markers={deltaMarkers}
      />
      <ReportMiniChart
        title="Trim"
        unit="cm"
        timeDomain={report.timeDomain}
        sessionDomain={report.sessionDomain}
        series={[{ label: "Trim", className: "trim", points: trimPoints }]}
        markers={trimMarkers}
        markerLabel="value"
        yPaddingRatio={0.32}
      />
    </div>
  );
}

function ReportMiniChart({
  title,
  unit,
  timeDomain,
  sessionDomain,
  series,
  markers = [],
  zeroLine = false,
  markerLabel = "quality",
  yPaddingRatio = 0.12,
}: {
  title: string;
  unit: string;
  timeDomain: TimeDomain;
  sessionDomain: TimeDomain;
  series: { label: string; className: string; points: { t: number; value: number | null }[] }[];
  markers?: ReportChartMarker[];
  zeroLine?: boolean;
  markerLabel?: "quality" | "value";
  yPaddingRatio?: number;
}) {
  const width = 760;
  const height = 138;
  const plot = { left: 48, top: 20, right: 18, bottom: 26 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const allValues = series
    .flatMap((item) => item.points.map((point) => point.value))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  allValues.push(
    ...markers
      .map((marker) => marker.value)
      .filter((value): value is number => value !== null && Number.isFinite(value)),
  );
  const rawMin = allValues.length
    ? zeroLine
      ? Math.min(0, ...allValues)
      : Math.min(...allValues)
    : 0;
  const rawMax = allValues.length
    ? zeroLine
      ? Math.max(0, ...allValues)
      : Math.max(...allValues)
    : 1;
  const range = Math.max(1, rawMax - rawMin);
  const minValue = rawMin - range * yPaddingRatio;
  const maxValue = rawMax + range * yPaddingRatio;
  const x = (time: number) =>
    plot.left +
    ((time - timeDomain.min) / Math.max(1, timeDomain.max - timeDomain.min)) *
      plotWidth;
  const y = (value: number) =>
    plot.top +
    plotHeight -
    ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const ticks = Array.from({ length: 5 }, (_, index) =>
    minValue + ((maxValue - minValue) / 4) * index,
  );
  const sessionStart = clamp(x(sessionDomain.min), plot.left, width - plot.right);
  const sessionEnd = clamp(x(sessionDomain.max), plot.left, width - plot.right);

  return (
    <article className="report-mini-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>{title} im Reportzeitraum</title>
        <rect
          className="report-session-window"
          x={sessionStart}
          y={plot.top}
          width={Math.max(1, sessionEnd - sessionStart)}
          height={plotHeight}
        />
        <text className="report-chart-title" x={plot.left} y={13}>
          {title}
        </text>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="grid-line"
              x1={plot.left}
              x2={width - plot.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={4} y={y(tick) + 3}>
              {formatNumber(tick, Math.abs(tick) >= 100 ? 0 : 1)}
            </text>
          </g>
        ))}
        {zeroLine && minValue < 0 && maxValue > 0 ? (
          <line
            className="zero-line"
            x1={plot.left}
            x2={width - plot.right}
            y1={y(0)}
            y2={y(0)}
          />
        ) : null}
        {series.map((item) => (
          <path
            key={item.label}
            className={`line ${item.className}`}
            d={linePath(item.points, x, y)}
          />
        ))}
        {markers
          .filter((marker) => marker.value !== null)
          .map((marker, index) => {
            const cx = x(marker.t);
            const cy = y(marker.value ?? 0);
            return (
              <g key={marker.id}>
                <circle
                  className={`report-session-dot ${ratingClass(marker.quality)}`}
                  cx={cx}
                  cy={cy}
                  r={4.6}
                />
                <text
                  className="report-session-label"
                  x={cx + 5}
                  y={cy - 5 - (index % 2) * 8}
                >
                  {markerLabel === "value" ? marker.label : `${marker.label}/5`}
                </text>
              </g>
            );
          })}
        <text x={plot.left} y={height - 5}>
          {formatTime(timeDomain.min)}
        </text>
        <text x={width - plot.right - 42} y={height - 5}>
          {formatTime(timeDomain.max)}
        </text>
        <text className="report-chart-unit" x={width - plot.right - 46} y={13}>
          {unit}
        </text>
      </svg>
      <div className="report-mini-legend">
        {series.map((item) => (
          <span key={item.label} className={item.className}>
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function ObservationSection({
  observations,
  observationForm,
  setObservationForm,
  submitObservation,
  observationSaving,
  editingObservationId,
  observationEditForm,
  setObservationEditForm,
  submitObservationEdit,
  cancelObservationEdit,
  observationMessage,
  editObservation,
  deleteObservation,
  deletingObservationId,
}: {
  observations: SurfObservation[];
  observationForm: ObservationFormState;
  setObservationForm: Dispatch<SetStateAction<ObservationFormState>>;
  submitObservation: (event: FormEvent<HTMLFormElement>) => void;
  observationSaving: boolean;
  editingObservationId: number | null;
  observationEditForm: ObservationFormState | null;
  setObservationEditForm: Dispatch<SetStateAction<ObservationFormState | null>>;
  submitObservationEdit: (
    id: number,
    event: FormEvent<HTMLFormElement>,
  ) => void;
  cancelObservationEdit: () => void;
  observationMessage: string;
  editObservation: (observation: SurfObservation) => void;
  deleteObservation: (id: number) => Promise<void>;
  deletingObservationId: number | null;
}) {
  return (
    <section
      className="observation-section"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
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
          {observationSaving ? "Speichert" : "Speichern"}
        </button>
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
          {observations.map((observation) => {
            const isEditing = editingObservationId === observation.id;
            return (
              <article
                key={observation.id}
                className={isEditing ? "is-editing" : undefined}
              >
                <div className="observation-card-head">
                  <span>{formatDate(observation.observedAt)}</span>
                  <div className="observation-card-actions">
                    {isEditing ? (
                      <button
                        type="button"
                        className="edit"
                        onClick={cancelObservationEdit}
                        disabled={observationSaving}
                      >
                        Abbrechen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="edit"
                        onClick={() => editObservation(observation)}
                        disabled={observationSaving}
                      >
                        Bearbeiten
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteObservation(observation.id)}
                      disabled={deletingObservationId === observation.id}
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                {isEditing && observationEditForm ? (
                  <form
                    className="observation-inline-form"
                    onSubmit={(event) => submitObservationEdit(observation.id, event)}
                  >
                    <label>
                      <span>Zeitpunkt</span>
                      <input
                        type="datetime-local"
                        required
                        value={observationEditForm.observedAt}
                        onChange={(event) =>
                          setObservationEditForm((current) =>
                            current
                              ? { ...current, observedAt: event.target.value }
                              : current,
                          )
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
                        value={observationEditForm.trimCm}
                        onChange={(event) =>
                          setObservationEditForm((current) =>
                            current
                              ? { ...current, trimCm: event.target.value }
                              : current,
                          )
                        }
                      />
                    </label>
                    <fieldset>
                      <legend>Welle</legend>
                      <div className="rating-slider">
                        <strong>{formatQuality(observationEditForm.quality)}</strong>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.1"
                          value={observationEditForm.quality}
                          aria-label="Wellenqualität von 1,0 bis 5,0"
                          onChange={(event) =>
                            setObservationEditForm((current) =>
                              current
                                ? { ...current, quality: Number(event.target.value) }
                                : current,
                            )
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
                        value={observationEditForm.note}
                        onChange={(event) =>
                          setObservationEditForm((current) =>
                            current ? { ...current, note: event.target.value } : current,
                          )
                        }
                        placeholder="optional"
                      />
                    </label>
                    <div className="inline-form-actions">
                      <button type="submit" disabled={observationSaving}>
                        {observationSaving ? "Speichert" : "Aktualisieren"}
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={cancelObservationEdit}
                        disabled={observationSaving}
                      >
                        Abbrechen
                      </button>
                    </div>
                    <small>
                      Pegel und Abfluss werden beim Speichern zur eingestellten
                      Uhrzeit neu aus den Messwerten zugeordnet.
                    </small>
                  </form>
                ) : (
                  <>
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
                  </>
                )}
              </article>
            );
          })}
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
  );
}

function SpotInsightSection({
  stats,
  targets,
}: {
  stats: SpotInsightStats;
  targets: ExperienceTargets;
}) {
  const hasLearnedTargets = targets.sampleSize > 0;

  return (
    <section className="spot-insight-section">
      <div className="section-heading spot-insight-heading">
        <div>
          <p>Spotinfos</p>
          <h2>Lernbereich aus Wellenmeisterwerten</h2>
        </div>
        <div className="spot-insight-source">
          <span>Datenbasis</span>
          <strong>{stats.linked} verknüpfte Werte</strong>
        </div>
      </div>

      <div className="spot-insight-grid">
        <details className="spot-insight-disclosure good">
          <summary>
            <span>Erfahrungs-Zielbereich</span>
            <strong>{hasLearnedTargets ? `${targets.confidence} % sicher` : "Fallback"}</strong>
          </summary>
          <article className="correlation-card">
            <span>Aus guten Bewertungen berechnet</span>
            <strong>
              {formatNumber(targets.flowMin, 1)}-
              {formatNumber(targets.flowMax, 1)} m³/s ·{" "}
              {formatNumber(targets.levelMin, 0)}-
              {formatNumber(targets.levelMax, 0)} cm
            </strong>
            <div className="target-range-grid">
              <div>
                <span>Abfluss</span>
                <strong>
                  {formatNumber(targets.flowMin, 1)}-
                  {formatNumber(targets.flowMax, 1)} m³/s
                </strong>
              </div>
              <div>
                <span>Pegel</span>
                <strong>
                  {formatNumber(targets.levelMin, 0)}-
                  {formatNumber(targets.levelMax, 0)} cm
                </strong>
              </div>
              <div>
                <span>Basis</span>
                <strong>{targets.basis}</strong>
              </div>
              <div>
                <span>Neues Setup</span>
                <strong>{targets.sameSetupCount} Werte</strong>
              </div>
            </div>
            <p>
              Dieser Bereich wird automatisch aus Wellenmeisterwerten ab 4,0/5
              konstruiert. Das aktuelle Setup wird bevorzugt, sobald mindestens
              drei gute Werte dafür vorhanden sind.
            </p>
            <dl>
              <div>
                <dt>Basis</dt>
                <dd>{targets.basis}</dd>
              </div>
              <div>
                <dt>Gute Werte</dt>
                <dd>{targets.sampleSize}</dd>
              </div>
              <div>
                <dt>Neues Setup</dt>
                <dd>{targets.sameSetupCount}</dd>
              </div>
            </dl>
          </article>
        </details>
        <details className="spot-insight-disclosure bad">
          <summary>
            <span>Gute / kritische Konditionen</span>
            <strong>{stats.good} / {stats.critical}</strong>
          </summary>
          <article className="correlation-card">
            <span>Aktuelle Lerntendenz</span>
            <strong>
              {stats.averageGoodQuality === null
                ? "noch zu wenig Daten"
                : `${formatQuality(stats.averageGoodQuality)}/5 bei Trim ${formatTrimCm(
                    stats.averageGoodTrim,
                    "",
                  )}`}
            </strong>
            <p>
              Gute Werte schieben Ziel-Pegel und Ziel-Abfluss mit der Zeit enger.
              Kritische Werte helfen dem Datenmodell, ähnliche Situationen
              abzuwerten.
            </p>
            <dl>
              <div>
                <dt>Alle Bewertungen</dt>
                <dd>{stats.total}</dd>
              </div>
              <div>
                <dt>Ø Delta gut</dt>
                <dd>{formatSignedNumber(stats.goodDeltaAverage, 2)} m³/s</dd>
              </div>
            </dl>
          </article>
        </details>
        <details className="spot-insight-disclosure">
          <summary>
            <span>Pegel-Abfluss-Korrelation</span>
            <strong>{formatCorrelation(stats.targetLevelFlowCorrelation)}</strong>
          </summary>
          <article className="correlation-card">
            <span>Zielbereich</span>
            <strong>
              {correlationHint(
                stats.targetLevelFlowCorrelation,
                stats.targetCorrelationCount,
              )}
            </strong>
            <p>
              Für den Zielbereich zählen nur gute Bewertungen ab 4,0/5 mit
              gespeicherten Reichenau-Pegel- und Abflusswerten. Ab drei passenden
              Punkten wird hier eine erste Tendenz sichtbar.
            </p>
            <dl>
              <div>
                <dt>Zielbereich Punkte</dt>
                <dd>{stats.targetCorrelationCount}</dd>
              </div>
              <div>
                <dt>Ziel-Korrelation</dt>
                <dd>{formatCorrelation(stats.targetLevelFlowCorrelation)}</dd>
              </div>
              <div>
                <dt>Alle Spotinfos</dt>
                <dd>
                  {formatCorrelation(stats.levelFlowCorrelation)} ·{" "}
                  {correlationHint(stats.levelFlowCorrelation, stats.levelFlowCount)}
                </dd>
              </div>
              <div>
                <dt>Fokus</dt>
                <dd>Pegel + Abfluss gemeinsam bewerten</dd>
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
  setupEditForm,
  setSetupEditForm,
  setupMessage,
  editingSetupId,
  setupSaving,
  deletingSetupId,
  onFormChange,
  onSubmit,
  onSubmitEdit,
  onEdit,
  onCancelEdit,
  onDelete,
}: {
  setupLogs: PlatformSetupLog[];
  setupForm: PlatformSetupFormState;
  setupEditForm: PlatformSetupFormState | null;
  setSetupEditForm: Dispatch<SetStateAction<PlatformSetupFormState | null>>;
  setupMessage: string;
  editingSetupId: number | null;
  setupSaving: boolean;
  deletingSetupId: number | null;
  onFormChange: Dispatch<SetStateAction<PlatformSetupFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitEdit: (id: number, event: FormEvent<HTMLFormElement>) => void;
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
          {setupSaving ? "Speichert" : "Setup speichern"}
        </button>
      </form>

      {setupMessage ? <p className="setup-message">{setupMessage}</p> : null}

      <div className="setup-log-list">
        {setupLogs.map((log) => {
          const isEditing = editingSetupId === log.id;
          return (
            <article key={log.id} className={isEditing ? "is-editing" : undefined}>
              <div className="setup-log-head">
                <div>
                  <span>{formatDate(log.loggedAt)}</span>
                  <strong>{log.waveMaster ?? "Wellenmeister:in n/a"}</strong>
                </div>
                <div className="setup-log-actions">
                  {isEditing ? (
                    <button
                      type="button"
                      className="edit"
                      onClick={onCancelEdit}
                      disabled={setupSaving}
                    >
                      Abbrechen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="edit"
                      onClick={() => onEdit(log)}
                      disabled={setupSaving}
                    >
                      Bearbeiten
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(log.id)}
                    disabled={deletingSetupId === log.id}
                  >
                    Löschen
                  </button>
                </div>
              </div>

              {isEditing && setupEditForm ? (
                <form
                  className="setup-inline-form"
                  onSubmit={(event) => onSubmitEdit(log.id, event)}
                >
                  <label>
                    <span>Datum & Uhrzeit</span>
                    <input
                      type="datetime-local"
                      required
                      value={setupEditForm.loggedAt}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current ? { ...current, loggedAt: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Wellenmeister:in</span>
                    <input
                      type="text"
                      value={setupEditForm.waveMaster}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, waveMaster: event.target.value }
                            : current,
                        )
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
                      value={setupEditForm.chainLeftCm}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, chainLeftCm: event.target.value }
                            : current,
                        )
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
                      value={setupEditForm.chainRightCm}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, chainRightCm: event.target.value }
                            : current,
                        )
                      }
                      placeholder="cm"
                    />
                  </label>
                  <label>
                    <span>Rampe</span>
                    <input
                      type="text"
                      value={setupEditForm.rampPosition}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, rampPosition: event.target.value }
                            : current,
                        )
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
                      value={setupEditForm.trimHeightCm}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, trimHeightCm: event.target.value }
                            : current,
                        )
                      }
                      placeholder="cm"
                    />
                  </label>
                  <label>
                    <span>Spannung li</span>
                    <select
                      value={setupEditForm.tensionLeft}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, tensionLeft: event.target.value }
                            : current,
                        )
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
                      value={setupEditForm.tensionRight}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current
                            ? { ...current, tensionRight: event.target.value }
                            : current,
                        )
                      }
                    >
                      <option value="">-</option>
                      <option value="true">Ja</option>
                      <option value="false">Nein</option>
                    </select>
                  </label>
                  <label className="setup-note-field">
                    <span>Bemerkungen</span>
                    <input
                      type="text"
                      value={setupEditForm.note}
                      onChange={(event) =>
                        setSetupEditForm((current) =>
                          current ? { ...current, note: event.target.value } : current,
                        )
                      }
                      placeholder="Was wurde verändert, wie war die Welle?"
                    />
                  </label>
                  <div className="setup-auto-field">
                    <span>Pegel Reichenau</span>
                    <strong>{setupEditForm.waterLevelCm || "auto"}</strong>
                  </div>
                  <div className="setup-auto-field">
                    <span>Abfluss Reichenau</span>
                    <strong>{setupEditForm.dischargeCms || "auto"}</strong>
                  </div>
                  <div className="inline-form-actions">
                    <button type="submit" disabled={setupSaving}>
                      {setupSaving ? "Speichert" : "Aktualisieren"}
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={onCancelEdit}
                      disabled={setupSaving}
                    >
                      Abbrechen
                    </button>
                  </div>
                  <small>
                    Pegel und Abfluss Reichenau werden beim Speichern passend zur
                    Uhrzeit neu zugeordnet.
                  </small>
                </form>
              ) : (
                <>
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
                        {formatBooleanFlag(log.tensionLeft)} /{" "}
                        {formatBooleanFlag(log.tensionRight)}
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
                </>
              )}
            </article>
          );
        })}
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

function MetricHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="metric-help">
      <span>{label}</span>
      <button type="button" className="metric-info" aria-label={`${label} erklären`}>
        i
      </button>
      <span className="metric-tooltip" role="tooltip">
        {children}
      </span>
    </span>
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
      <div className="trim-suggestion">
        <span>
          Trimvorschlag <span className="beta-badge">BETA</span>
        </span>
        <strong>{formatTrimRange(quality.trimSuggestion)}</strong>
        <small>
          {quality.trimSuggestion.confidence
            ? `${quality.trimSuggestion.confidence} % Sicherheit · ${quality.trimSuggestion.matchedCount} Treffer`
            : "Noch zu wenig Daten"}
        </small>
        <em>{quality.trimSuggestion.note}</em>
      </div>
      <dl>
        <div>
          <dt>Zeit</dt>
          <dd>{formatTime(quality.time)}</dd>
        </div>
        <div>
          <dt>
            <MetricHelp label="Delta (Zufluss/Abfluss)">
              Reichenau-Abfluss minus Summe Krössbach + Puig mit Laufzeitkorrektur.
              Positiv bedeutet: Es kommt mehr Wasser an als aus den Oberliegern
              erwartet. Negativ bedeutet: Es kommt weniger an, z.B. durch Rückhalt
              oder Verzögerung.
            </MetricHelp>
          </dt>
          <dd>
            {quality.delta >= 0 ? "+" : ""}
            {formatNumber(quality.delta, 2)} m³/s
          </dd>
        </div>
        <div>
          <dt>
            <MetricHelp label="Zuflüsse">
              Summe aus Krössbach und Puig am erwarteten Wellenzeitpunkt. Beide
              Werte werden mit den eingestellten Laufzeiten zeitlich verschoben.
            </MetricHelp>
          </dt>
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
          <dt>
            <MetricHelp label="Ø Differenz 60 min">
              Volumenbilanz der letzten 60 Minuten, umgerechnet in eine
              durchschnittliche Abflussdifferenz. Positiv heißt: über den Zeitraum
              kam mehr Wasser an als erwartet. Negativ heißt: es kam weniger an.
            </MetricHelp>
          </dt>
          <dd>{formatVolumeBalanceFlow(quality.volumeBalance60)} m³/s</dd>
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
  kroessbachRuntime,
  puigRuntime,
  settings,
}: {
  summary: RuntimeComparisonSummary;
  kroessbachRuntime?: string | null;
  puigRuntime?: string | null;
  settings: ForecastSettings;
}) {
  const kroessbachWaveMinutes = Math.max(0, settings.lagKroessbach - settings.waveOffset);
  const puigWaveMinutes = Math.max(0, settings.lagPuig - settings.waveOffset);

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
        <article className="runtime-recommendation-card">
          <span>Empfohlene Einstellung</span>
          <strong>
            {summary.recommendation
              ? `${summary.recommendation.lagKroessbach} / ${summary.recommendation.lagPuig} min`
              : "n/a"}
          </strong>
          <small>
            {summary.recommendation
              ? `Krössbach / Puig · ${summary.recommendation.confidence} % Sicherheit · ${summary.recommendation.count} Vergleiche`
              : "Noch zu wenig Daten im sichtbaren Zeitraum."}
          </small>
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
      {summary.recommendation ? (
        <p className="runtime-recommendation-note">
          Empfehlung basiert auf dem besten Muster im aktuellen Zeitbereich:
          Korrelation {formatCorrelation(summary.recommendation.correlation)}, Ø
          Abweichung {formatNumber(summary.recommendation.meanAbsoluteDelta, 2)} m³/s.
          Die Werte sind ein Hinweis zum Feintunen, kein automatischer Umbau der Regler.
        </p>
      ) : null}
      <div className="runtime-reference-grid">
        <article>
          <span>Offiziell Krössbach → Reichenau</span>
          <strong>{kroessbachRuntime ?? "n/a"}</strong>
          <small>
            Regler aktuell {settings.lagKroessbach} min bis Reichenau; an der Welle
            ca. {kroessbachWaveMinutes} min vorher sichtbar.
          </small>
        </article>
        <article>
          <span>Offiziell Puig → Reichenau</span>
          <strong>{puigRuntime ?? "n/a"}</strong>
          <small>
            Regler aktuell {settings.lagPuig} min bis Reichenau; an der Welle ca.{" "}
            {puigWaveMinutes} min vorher sichtbar.
          </small>
        </article>
        <article>
          <span>Gärberbach → Welle</span>
          <strong>3,6 km · ca. 10 min</strong>
          <small>
            Pegel-Reaktionszeit: ein Anstieg am Gärberbach sollte grob 10 min
            spaeter an der Welle sichtbar werden.
          </small>
        </article>
        <article>
          <span>Welle → Reichenau</span>
          <strong>3,1 km · ca. 10 min</strong>
          <small>
            Reichenau liegt flussab der Welle; die bisherige Wellen-Korrektur
            bleibt damit plausibel.
          </small>
        </article>
        <article className="runtime-reference-note">
          <span>Einordnung</span>
          <strong>Die aktuellen Regler liegen im offiziellen Laufzeitbereich.</strong>
          <small>
            Das ist fuer den Forecast plausibel: Krössbach 75-150 min und Puig
            60-120 min bis Reichenau. Weil die Welle ca. 10 min vor dem Pegel liegt,
            wird die Wirkung an der Welle entsprechend frueher angesetzt. Kraftwerke
            und seitliche Zuflüsse koennen die reale Reaktion trotzdem verschieben.
            Der Gärberbach-Pegel kommt aus RiverApp und wird als Pegel-/Trend-
            Referenz genutzt, nicht als Abflussmessung.
          </small>
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
          <dd>automatisch in Wellenqualität gewichtet</dd>
        </div>
      </dl>
    </section>
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
  timeControl,
}: {
  history: HistoryPoint[];
  forecast: { t: number; value: number | null }[];
  timeDomain: TimeDomain;
  markerTime: number;
  surfMin: number;
  surfMax: number;
  observations: SurfObservation[];
  timeControl?: ReactNode;
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
      {timeControl ? <div className="forecast-chart-controls">{timeControl}</div> : null}
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
          Erfahrungsbereich
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
  balance30Series,
  balance60Series,
  balance120Series,
  timeDomain,
  markerTime,
  balance30,
  balance60,
  balance120,
}: {
  balance30Series: { t: number; value: number | null }[];
  balance60Series: { t: number; value: number | null }[];
  balance120Series: { t: number; value: number | null }[];
  timeDomain: TimeDomain;
  markerTime: number;
  balance30: number | null;
  balance60: number | null;
  balance120: number | null;
}) {
  const [windowMinutes, setWindowMinutes] = useState<VolumeWindowMinutes>(60);
  const balanceByWindow = {
    30: { current: balance30, series: balance30Series },
    60: { current: balance60, series: balance60Series },
    120: { current: balance120, series: balance120Series },
  } satisfies Record<
    VolumeWindowMinutes,
    { current: number | null; series: { t: number; value: number | null }[] }
  >;
  const activeBalance = balanceByWindow[windowMinutes];
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleBalance = activeBalance.series.filter(inTimeDomain);
  const values = visibleBalance
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
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
      <div
        className="volume-toolbar"
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <label className="compact-select">
          <span>Bilanzfenster</span>
          <select
            value={windowMinutes}
            onChange={(event) =>
              setWindowMinutes(Number(event.target.value) as VolumeWindowMinutes)
            }
          >
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={120}>120 min</option>
          </select>
        </label>
        <div>
          <span>Aktuell</span>
          <strong>{formatVolume(activeBalance.current)} m³</strong>
        </div>
      </div>
      <p className="chart-explain-card">
        Volumenbilanz = Delta Welle über das gewählte Zeitfenster aufsummiert.
        Positiv bedeutet: Es kommt mehr Wasser in Reichenau an, als die
        zeitkorrigierten Zuflüsse Krössbach + Puig erklären. Negativ bedeutet:
        Es kommt weniger an.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Volumenbilanz aus Delta im Verhältnis zur Zeit</title>
        <text className="chart-title" x={plot.left} y={18}>
          Volumenbilanz
        </text>
        <text className="chart-subtitle" x={plot.left} y={34}>
          Rollende {windowMinutes} min aus Delta m³/s integriert
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
        <path className="line volume" d={linePath(visibleBalance, x, y)} />
      </svg>
      <div className="chart-legend">
        <span className="legend-static volume">Volumenbilanz {windowMinutes} min</span>
      </div>
    </div>
  );
}

function RainfallSection({
  weather,
  visiblePoints,
  visibleForecast,
  timeDomain,
  markerTime,
  error,
}: {
  weather: WeatherPayload;
  visiblePoints: WeatherPoint[];
  visibleForecast: WeatherPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
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
      <RainfallChart
        stations={weather.stations}
        points={visiblePoints}
        forecast={visibleForecast}
        timeDomain={timeDomain}
        markerTime={markerTime}
      />
      <p className="rain-note">
        Die Balken zeigen das Gebietsmittel der ausgewählten Stationen. Das Signal
        wird erst nach der Auswertung gegen Delta, Pegel und Abfluss in die
        Wellenqualität gewichtet. Die gestrichelte Linie ist der GeoSphere-Nowcast.
      </p>
    </section>
  );
}

function RainfallChart({
  stations,
  points,
  forecast,
  timeDomain,
  markerTime,
}: {
  stations: WeatherStation[];
  points: WeatherPoint[];
  forecast: WeatherPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
}) {
  const [visible, setVisible] = useState<Record<RainSeriesKey, boolean>>({
    area: true,
    forecast: true,
    innsbruck_uni: false,
    neustift: true,
    steinach: true,
    brenner: true,
    patscherkofel: false,
  });
  const toggle = (key: RainSeriesKey) =>
    setVisible((current) => ({ ...current, [key]: !current[key] }));
  const aggregate = aggregateRainSeries(points);
  const forecastAggregate = aggregateRainSeries(forecast);
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
  const forecastValues = visible.forecast
    ? forecastAggregate.map((point) => point.value)
    : [];
  const allValues = [...aggregateValues, ...forecastValues, ...activeStationValues];
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
        {visible.forecast ? (
          <path
            className="line rain-forecast"
            d={linePath(forecastAggregate, x, y)}
          />
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
      </svg>
      <div className="chart-legend">
        <LegendToggle name="rain-area" active={visible.area} onClick={() => toggle("area")}>
          Gebietsmittel Regen
        </LegendToggle>
        <LegendToggle
          name="rain-forecast"
          active={visible.forecast}
          onClick={() => toggle("forecast")}
        >
          Regenforecast <b>BETA</b>
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
  observations,
}: {
  history: HistoryPoint[];
  timeDomain: TimeDomain;
  markerTime: number;
  levelMin: number;
  levelMax: number;
  observations: SurfObservation[];
}) {
  const [visible, setVisible] = useState<Record<LevelSeriesKey, boolean>>({
    kroessbach: true,
    puig: true,
    gaerberbach: true,
    reichenau: true,
    session: true,
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
  const gaerberbachLevel = history.map((point) => ({
    t: point.t,
    value: point.gaerberbachLevel,
  }));
  const reichenauLevel = history.map((point) => ({
    t: point.t,
    value: point.reichenauLevel,
  }));
  const inTimeDomain = (point: { t: number }) =>
    point.t >= timeDomain.min && point.t <= timeDomain.max;
  const visibleKroessbachLevel = kroessbachLevel.filter(inTimeDomain);
  const visiblePuigLevel = puigLevel.filter(inTimeDomain);
  const visibleGaerberbachLevel = gaerberbachLevel.filter(inTimeDomain);
  const visibleReichenauLevel = reichenauLevel.filter(inTimeDomain);
  const visibleSessionPoints = observations
    .map((observation) => ({
      id: observation.id,
      t: observation.observedAt,
      value: observation.reichenauLevel,
      quality: observation.quality,
      trimCm: observation.trimCm,
      kroessbachDischarge: observation.kroessbachDischarge,
      puigDischarge: observation.puigDischarge,
      reichenauDischarge: observation.reichenauDischarge,
      kroessbachLevel: observation.kroessbachLevel,
      puigLevel: observation.puigLevel,
      reichenauLevel: observation.reichenauLevel,
    }))
    .filter(inTimeDomain);
  const series = [
    ...(visible.kroessbach ? visibleKroessbachLevel : []),
    ...(visible.puig ? visiblePuigLevel : []),
    ...(visible.gaerberbach ? visibleGaerberbachLevel : []),
    ...(visible.reichenau ? visibleReichenauLevel : []),
    ...(visible.session ? visibleSessionPoints : []),
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
        {visible.gaerberbach ? (
          <path
            className="line gaerberbach"
            d={linePath(visibleGaerberbachLevel, x, y)}
          />
        ) : null}
        {visible.reichenau ? (
          <path
            className="line reichenau"
            d={linePath(visibleReichenauLevel, x, y)}
          />
        ) : null}
        {visible.session ? visibleSessionPoints.map((point) =>
          point.value === null ? null : (
            <g key={point.id}>
              <title>
                {`Session ${formatTime(point.t)} · Qualität ${formatQuality(point.quality)}/5 · Trim ${formatTrimCm(
                  point.trimCm,
                  "",
                )} · Pegel K/P/R ${formatTriple(
                  point.kroessbachLevel,
                  point.puigLevel,
                  point.reichenauLevel,
                  1,
                )} cm · Abfluss K/P/R ${formatTriple(
                  point.kroessbachDischarge,
                  point.puigDischarge,
                  point.reichenauDischarge,
                  2,
                )} m³/s`}
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
        <LegendToggle name="kroessbach" active={visible.kroessbach} onClick={() => toggle("kroessbach")}>
          Krössbach Pegel
        </LegendToggle>
        <LegendToggle name="puig" active={visible.puig} onClick={() => toggle("puig")}>
          Puig Pegel
        </LegendToggle>
        <LegendToggle name="gaerberbach" active={visible.gaerberbach} onClick={() => toggle("gaerberbach")}>
          Gärberbach Pegel
        </LegendToggle>
        <LegendToggle name="reichenau" active={visible.reichenau} onClick={() => toggle("reichenau")}>
          Reichenau Pegel
        </LegendToggle>
        <LegendToggle name="session" active={visible.session} onClick={() => toggle("session")}>
          Sessionwerte
        </LegendToggle>
        <LegendToggle name="level-range" active={visible.range} onClick={() => toggle("range")}>
          Pegel-Erfahrungsbereich
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
    <div
      className="chart-time-control"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
    >
      <div className="chart-time-head">
        <span>Zeitbereich</span>
        <strong>{fromLabel} bis {toLabel}</strong>
      </div>
      <label className="compact-select">
        <span>Daten anzeigen</span>
        <select
          value={range.preset}
          aria-label="Zeitbereich auswählen"
          onChange={(event) =>
            onChange({
              ...range,
              preset: event.target.value as ReviewPreset,
            })
          }
        >
          {reviewPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
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
