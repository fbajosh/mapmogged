import {
  angularDistanceDegrees,
  classifyRouteAngle,
  createRouteEdge,
  interpolateRouteEdge,
} from "./route-geometry.js";

const EARTH_RADIUS_M = 6371e3;
const MAX_PLAYBACK_SAMPLES = 500_000;
const SAMPLE_STRIDE = 4;

const DURATION_UNIT_MS = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

const DISTANCE_UNITS = {
  mph: { label: "miles", metersPerUnit: 1609.344 },
  kmh: { label: "km", metersPerUnit: 1000 },
  mps: { label: "meters", metersPerUnit: 1 },
  knots: { label: "NM", metersPerUnit: 1852 },
};

class PlaybackSampleLimitError extends Error {
  constructor(requestedSamples, maxSamples, minimumIntervalMs) {
    super(
      `This interval would create ${formatInteger(requestedSamples)} playback samples. ` +
        `Use an interval of at least ${formatDurationCompact(minimumIntervalMs)}.`,
    );
    this.name = "PlaybackSampleLimitError";
    this.code = "PLAYBACK_SAMPLE_LIMIT";
    this.requestedSamples = requestedSamples;
    this.maxSamples = maxSamples;
    this.minimumIntervalMs = minimumIntervalMs;
  }
}

function buildPlaybackSequence(layers, intervalMs, options = {}) {
  const normalizedIntervalMs = Number(intervalMs);
  if (!Number.isFinite(normalizedIntervalMs) || normalizedIntervalMs <= 0) {
    throw new TypeError("Playback interval must be greater than zero.");
  }

  const playable = [];
  for (const layer of layers ?? []) {
    if (layer?.status && layer.status !== "ready") continue;
    const points = normalizePlaybackPoints(layer?.cleanedPoints ?? []);
    if (points.length < 2 || points.at(-1).timeMs <= points[0].timeMs) continue;
    playable.push({ layer, points });
  }

  const requestedSamples = countRequestedSamples(playable, normalizedIntervalMs);
  const maxSamples = options.maxSamples ?? MAX_PLAYBACK_SAMPLES;

  if (requestedSamples > maxSamples) {
    const minimumIntervalMs = getMinimumIntervalForSampleLimit(playable, maxSamples);
    throw new PlaybackSampleLimitError(requestedSamples, maxSamples, minimumIntervalMs);
  }

  const segments = [];
  let sourceDurationMs = 0;
  let totalDistanceM = 0;
  let sourcePointCount = 0;

  for (const { layer, points } of playable) {
    const sourceStartMs = points[0].timeMs;
    const sourceEndMs = points.at(-1).timeMs;
    const durationMs = sourceEndMs - sourceStartMs;
    const cumulativeDistances = buildCumulativeDistances(points);
    const sourceRoute = buildRouteMetadata(points.length, (index) => points[index]);
    const samples = resamplePoints(points, cumulativeDistances, normalizedIntervalMs, sourceRoute);
    const sourceSamples = buildSourceSamples(points, cumulativeDistances);
    const sampleRoute = buildPackedRouteMetadata(samples);
    const distanceM = cumulativeDistances.at(-1) ?? 0;

    segments.push({
      layerId: layer.id,
      color: layer.color || "#2563eb",
      colorMode: layer.colorMode === "gradient" ? "gradient" : "solid",
      gradientStartColor: layer.gradientStartColor || layer.color || "#2563eb",
      gradientEndColor: layer.gradientEndColor || layer.color || "#2563eb",
      width: Number.isFinite(layer.size) ? layer.size : 2.5,
      sequenceStartMs: sourceDurationMs,
      sourceStartMs,
      sourceEndMs,
      durationMs,
      distanceStartM: totalDistanceM,
      distanceM,
      sampleCount: samples.length / SAMPLE_STRIDE,
      samples,
      sampleRoute,
      sourceSampleCount: sourceSamples.length / SAMPLE_STRIDE,
      sourceSamples,
      sourceRoute,
    });

    sourceDurationMs += durationMs;
    totalDistanceM += distanceM;
    sourcePointCount += points.length;
  }

  return {
    intervalMs: normalizedIntervalMs,
    sourceDurationMs,
    totalDistanceM,
    sampleCount: requestedSamples,
    sourcePointCount,
    segments,
  };
}

function normalizePlaybackPoints(points) {
  const normalized = [];

  for (const point of points) {
    const lat = Number(point?.[0]);
    const lon = Number(point?.[1]);
    const timeMs = Number(point?.[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(timeMs)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const candidate = { lat, lon, timeMs };
    const previous = normalized.at(-1);
    if (previous?.timeMs === timeMs) {
      normalized[normalized.length - 1] = candidate;
      continue;
    }
    if (previous && previous.timeMs > timeMs) continue;
    normalized.push(candidate);
  }

  return normalized;
}

function buildCumulativeDistances(points) {
  const distances = new Float64Array(points.length);
  for (let index = 1; index < points.length; index += 1) {
    distances[index] =
      distances[index - 1] +
      haversineMeters(points[index - 1].lat, points[index - 1].lon, points[index].lat, points[index].lon);
  }
  return distances;
}

function getResampledCount(durationMs, intervalMs) {
  if (durationMs <= 0) return 0;
  const completeIntervals = Math.floor(durationMs / intervalMs);
  return completeIntervals + 1 + (completeIntervals * intervalMs < durationMs ? 1 : 0);
}

function countRequestedSamples(playable, intervalMs) {
  return playable.reduce(
    (sum, entry) => sum + getResampledCount(entry.points.at(-1).timeMs - entry.points[0].timeMs, intervalMs),
    0,
  );
}

function getMinimumIntervalForSampleLimit(playable, maxSamples) {
  let low = 1;
  let high = Math.max(...playable.map((entry) => entry.points.at(-1).timeMs - entry.points[0].timeMs));
  if (countRequestedSamples(playable, high) > maxSamples) return high;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (countRequestedSamples(playable, middle) <= maxSamples) high = middle;
    else low = middle + 1;
  }
  return low;
}

function resamplePoints(points, cumulativeDistances, intervalMs, routeMetadata) {
  const startMs = points[0].timeMs;
  const durationMs = points.at(-1).timeMs - startMs;
  const sampleCount = getResampledCount(durationMs, intervalMs);
  const samples = new Float64Array(sampleCount * SAMPLE_STRIDE);
  let sourceIndex = 0;
  let routeEdge = null;
  let routeEdgeIndex = -1;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const isLast = sampleIndex === sampleCount - 1;
    const localElapsedMs = isLast ? durationMs : Math.min(durationMs, sampleIndex * intervalMs);
    const targetMs = startMs + localElapsedMs;

    while (sourceIndex < points.length - 2 && points[sourceIndex + 1].timeMs < targetMs) {
      sourceIndex += 1;
    }

    const start = points[sourceIndex];
    const end = points[Math.min(sourceIndex + 1, points.length - 1)];
    const edgeDuration = end.timeMs - start.timeMs;
    const ratio = edgeDuration > 0 ? clamp((targetMs - start.timeMs) / edgeDuration, 0, 1) : 0;
    const edgeDistance = cumulativeDistances[sourceIndex + 1] - cumulativeDistances[sourceIndex];
    const offset = sampleIndex * SAMPLE_STRIDE;
    if (routeEdgeIndex !== sourceIndex) {
      routeEdge = getObjectRouteEdge(points, sourceIndex, routeMetadata);
      routeEdgeIndex = sourceIndex;
    }
    const position = interpolateRouteEdge(routeEdge, ratio);
    samples[offset] = position.lat;
    samples[offset + 1] = position.lon;
    samples[offset + 2] = localElapsedMs;
    samples[offset + 3] = cumulativeDistances[sourceIndex] + edgeDistance * ratio;
  }

  return samples;
}

function buildSourceSamples(points, cumulativeDistances) {
  const sourceStartMs = points[0].timeMs;
  const samples = new Float64Array(points.length * SAMPLE_STRIDE);
  for (let index = 0; index < points.length; index += 1) {
    const offset = index * SAMPLE_STRIDE;
    samples[offset] = points[index].lat;
    samples[offset + 1] = points[index].lon;
    samples[offset + 2] = points[index].timeMs - sourceStartMs;
    samples[offset + 3] = cumulativeDistances[index];
  }
  return samples;
}

function samplePlaybackAt(sequence, sourceElapsedMs, options = {}) {
  if (!sequence?.segments?.length) return null;
  const elapsedMs = clamp(Number(sourceElapsedMs) || 0, 0, sequence.sourceDurationMs);
  const segmentIndex = findSegmentIndex(sequence.segments, elapsedMs, sequence.sourceDurationMs);
  const segment = sequence.segments[segmentIndex];
  const localElapsedMs = clamp(elapsedMs - segment.sequenceStartMs, 0, segment.durationMs);
  const timedSample = sampleTimedPathAt(
    segment.samples,
    segment.sampleCount,
    localElapsedMs,
    segment.sampleRoute,
  );
  const position = options.pathMode === "tracking-only"
    ? samplePathAtDistance(
      segment.sourceSamples,
      segment.sourceSampleCount,
      timedSample.distanceM,
      segment.sourceRoute,
    )
    : timedSample;

  return {
    segmentIndex,
    layerId: segment.layerId,
    sampleIndex: timedSample.startIndex,
    nextSampleIndex: timedSample.endIndex,
    sampleRatio: timedSample.ratio,
    lat: position.lat,
    lon: position.lon,
    timeMs: segment.sourceStartMs + localElapsedMs,
    sourceElapsedMs: elapsedMs,
    localElapsedMs,
    localDistanceM: timedSample.distanceM,
    distanceCoveredM: segment.distanceStartM + timedSample.distanceM,
    totalDistanceM: sequence.totalDistanceM,
  };
}

function samplePathAtDistance(samples, sampleCount, distanceM, routeMetadata = null) {
  const distance = Math.max(0, Number(distanceM) || 0);
  const last = sampleCount - 1;
  const lastDistance = samples[last * SAMPLE_STRIDE + 3];
  if (distance <= 0) return getInterpolatedSample(samples, sampleCount, 0, 0, 0, routeMetadata);
  if (distance >= lastDistance) {
    return getInterpolatedSample(samples, sampleCount, last, last, 0, routeMetadata);
  }

  let low = 0;
  let high = last;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const middleDistance = samples[middle * SAMPLE_STRIDE + 3];
    if (middleDistance <= distance) low = middle;
    else high = middle;
  }

  const startDistance = samples[low * SAMPLE_STRIDE + 3];
  const endDistance = samples[high * SAMPLE_STRIDE + 3];
  const ratio = endDistance > startDistance ? (distance - startDistance) / (endDistance - startDistance) : 0;
  return getInterpolatedSample(samples, sampleCount, low, high, ratio, routeMetadata);
}

function findSegmentIndex(segments, elapsedMs, totalDurationMs) {
  if (elapsedMs >= totalDurationMs) return segments.length - 1;
  let low = 0;
  let high = segments.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const endMs = segments[middle].sequenceStartMs + segments[middle].durationMs;
    if (elapsedMs < endMs) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return low;
}

function sampleTimedPathAt(samples, sampleCount, localElapsedMs, routeMetadata = null) {
  const { startIndex, endIndex, ratio } = findSampleRange(samples, sampleCount, localElapsedMs);
  return getInterpolatedSample(samples, sampleCount, startIndex, endIndex, ratio, routeMetadata);
}

function getInterpolatedSample(samples, sampleCount, startIndex, endIndex, ratio, routeMetadata) {
  const startOffset = startIndex * SAMPLE_STRIDE;
  const endOffset = endIndex * SAMPLE_STRIDE;
  const position = startIndex === endIndex
    ? { lat: samples[startOffset], lon: samples[startOffset + 1] }
    : interpolateRouteEdge(
      getPackedRouteEdge(samples, sampleCount, startIndex, routeMetadata),
      ratio,
    );
  return {
    startIndex,
    endIndex,
    ratio,
    lat: position.lat,
    lon: position.lon,
    distanceM: interpolate(samples[startOffset + 3], samples[endOffset + 3], ratio),
  };
}

function buildPackedRouteMetadata(samples) {
  const sampleCount = samples.length / SAMPLE_STRIDE;
  return buildRouteMetadata(sampleCount, (index) => getPackedPoint(samples, index));
}

function buildRouteMetadata(pointCount, getPoint) {
  const edgeCount = Math.max(0, pointCount - 1);
  const edgeKinds = new Uint8Array(edgeCount);
  const edgeAngles = new Float32Array(edgeCount);
  for (let index = 0; index < edgeCount; index += 1) {
    const angleDegrees = angularDistanceDegrees(getPoint(index), getPoint(index + 1));
    edgeKinds[index] = classifyRouteAngle(angleDegrees);
    edgeAngles[index] = angleDegrees;
  }
  return { edgeKinds, edgeAngles };
}

function getObjectRouteEdge(points, edgeIndex, routeMetadata) {
  return createRouteEdge(
    edgeIndex > 0 ? points[edgeIndex - 1] : null,
    points[edgeIndex],
    points[edgeIndex + 1],
    edgeIndex + 2 < points.length ? points[edgeIndex + 2] : null,
    getRouteEdgeOptions(routeMetadata, edgeIndex),
  );
}

function getPackedRouteEdge(samples, sampleCount, edgeIndex, routeMetadata = null) {
  return createRouteEdge(
    edgeIndex > 0 ? getPackedPoint(samples, edgeIndex - 1) : null,
    getPackedPoint(samples, edgeIndex),
    getPackedPoint(samples, edgeIndex + 1),
    edgeIndex + 2 < sampleCount ? getPackedPoint(samples, edgeIndex + 2) : null,
    getRouteEdgeOptions(routeMetadata, edgeIndex),
  );
}

function getPackedPoint(samples, index) {
  const offset = index * SAMPLE_STRIDE;
  return { lat: samples[offset], lon: samples[offset + 1] };
}

function getRouteEdgeOptions(routeMetadata, edgeIndex) {
  if (!routeMetadata?.edgeKinds || !routeMetadata?.edgeAngles) return {};
  return {
    kind: routeMetadata.edgeKinds[edgeIndex],
    angleDegrees: routeMetadata.edgeAngles[edgeIndex],
  };
}

function findSampleRange(samples, sampleCount, localElapsedMs) {
  if (localElapsedMs <= 0) return { startIndex: 0, endIndex: 0, ratio: 0 };
  const last = sampleCount - 1;
  const lastTime = samples[last * SAMPLE_STRIDE + 2];
  if (localElapsedMs >= lastTime) {
    return { startIndex: last, endIndex: last, ratio: 0 };
  }

  let low = 0;
  let high = last;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const middleTime = samples[middle * SAMPLE_STRIDE + 2];
    if (middleTime <= localElapsedMs) low = middle;
    else high = middle;
  }

  const startTime = samples[low * SAMPLE_STRIDE + 2];
  const endTime = samples[high * SAMPLE_STRIDE + 2];
  return {
    startIndex: low,
    endIndex: high,
    ratio: endTime > startTime ? (localElapsedMs - startTime) / (endTime - startTime) : 0,
  };
}

function derivePlaybackDuration(sourceDurationMs, multiplier) {
  const source = Number(sourceDurationMs);
  const rate = Number(multiplier);
  return source > 0 && rate > 0 && Number.isFinite(source) && Number.isFinite(rate) ? source / rate : NaN;
}

function deriveMultiplier(sourceDurationMs, playbackDurationMs) {
  const source = Number(sourceDurationMs);
  const duration = Number(playbackDurationMs);
  return source > 0 && duration > 0 && Number.isFinite(source) && Number.isFinite(duration)
    ? source / duration
    : NaN;
}

function durationValueToMs(value, unit) {
  const number = Number(value);
  const multiplier = DURATION_UNIT_MS[unit];
  return number > 0 && Number.isFinite(number) && multiplier ? number * multiplier : NaN;
}

function getPreferredDurationUnit(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value <= 0) return "seconds";
  if (value >= DURATION_UNIT_MS.days) return "days";
  if (value >= DURATION_UNIT_MS.hours) return "hours";
  if (value >= DURATION_UNIT_MS.minutes) return "minutes";
  return "seconds";
}

function formatDistance(meters, speedUnitId) {
  const unit = DISTANCE_UNITS[speedUnitId] ?? DISTANCE_UNITS.mps;
  const value = Math.max(0, Number(meters) || 0) / unit.metersPerUnit;
  return {
    value,
    unit: unit.label,
    text: value.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  };
}

function formatPlaybackSpeed(multiplier) {
  const value = Number(multiplier);
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toLocaleString("en-US", { maximumSignificantDigits: 2 });
}

function formatPlaybackClock(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value < 0) return "—:—";
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatElapsed(elapsedMs) {
  const milliseconds = Math.max(0, Number(elapsedMs) || 0);
  const minutes = milliseconds / DURATION_UNIT_MS.minutes;
  let value;
  let unit;

  if (minutes < 60) {
    value = minutes;
    unit = "minutes";
  } else if (minutes <= 36 * 60) {
    value = minutes / 60;
    unit = "hours";
  } else if (minutes < 365 * 24 * 60) {
    value = minutes / (24 * 60);
    unit = "days";
  } else {
    value = minutes / (365 * 24 * 60);
    unit = "years";
  }

  return {
    value,
    unit,
    text: value.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  };
}

function formatLocalDate(timeMs) {
  const date = new Date(timeMs);
  if (!Number.isFinite(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.month} ${values.day}`;
}

function formatDurationCompact(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(shortestLongitudeDelta(lon1, lon2));
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

function shortestLongitudeDelta(start, end) {
  return ((end - start + 540) % 360) - 180;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
}

export {
  DISTANCE_UNITS,
  DURATION_UNIT_MS,
  MAX_PLAYBACK_SAMPLES,
  PlaybackSampleLimitError,
  SAMPLE_STRIDE,
  buildPlaybackSequence,
  deriveMultiplier,
  derivePlaybackDuration,
  durationValueToMs,
  formatDistance,
  formatElapsed,
  formatLocalDate,
  formatPlaybackClock,
  formatPlaybackSpeed,
  getPreferredDurationUnit,
  haversineMeters,
  samplePlaybackAt,
  samplePathAtDistance,
  sampleTimedPathAt,
};
