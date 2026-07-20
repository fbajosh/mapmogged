import { getDateFilterReason } from "./date-filter.js";

const KEY = '"timelinePath"';
const EARTH_RADIUS_M = 6371e3;
const PROGRESS_INTERVAL_MS = 250;

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("message", async (event) => {
    if (event.data?.type !== "parse") return;

    try {
      const { file, options } = event.data;
      const result =
        options.fileType === "csv" ? await parseCsvFile(file, options) : await parseJsonFile(file, options);

      self.postMessage({
        type: "done",
        points: result.points,
        stats: result.stats,
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

async function parseJsonFile(file, options) {
  const parser = new TimelinePathParser((path) => handlePath(path, options));
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  const stats = createStats(file.size);
  const rawPoints = [];
  const cleanedPoints = [];
  const cleanState = createCleanState();
  let lastProgressAt = 0;

  function keepPoint(point) {
    stats.rawCount += 1;
    rawPoints.push(point);
  }

  function handlePath(path) {
    const point = normalizePathPoint(path);
    if (!point) {
      stats.skippedInvalid += 1;
      return;
    }
    keepPoint(point);
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    stats.bytesRead += value.byteLength;
    parser.push(decoder.decode(value, { stream: true }));

    const now = performance.now();
    if (now - lastProgressAt > PROGRESS_INTERVAL_MS) {
      postProgress(stats, cleanedPoints.length);
      lastProgressAt = now;
    }
  }

  parser.push(decoder.decode());
  parser.finish();

  stats.outOfOrderCount = countOutOfOrder(rawPoints);
  rawPoints.sort((a, b) => a.timeMs - b.timeMs);
  setTimeBounds(stats, rawPoints);
  for (const point of rawPoints) {
    maybeKeepFilteredPoint(point, cleanState, cleanedPoints, stats, options);
  }

  return {
    points: cleanedPoints,
    stats: summarizeStats(stats),
  };
}

async function parseCsvFile(file, options) {
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  const stats = createStats(file.size);
  const rawPoints = [];
  const cleanedPoints = [];
  const cleanState = createCleanState();
  const parser = new CsvPointParser((point) => keepPoint(point), () => {
    stats.skippedInvalid += 1;
  });
  let lastProgressAt = 0;

  function keepPoint(point) {
    stats.rawCount += 1;
    rawPoints.push(point);
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    stats.bytesRead += value.byteLength;
    parser.push(decoder.decode(value, { stream: true }));

    const now = performance.now();
    if (now - lastProgressAt > PROGRESS_INTERVAL_MS) {
      postProgress(stats, cleanedPoints.length);
      lastProgressAt = now;
    }
  }

  parser.push(decoder.decode());
  parser.finish();

  stats.outOfOrderCount = countOutOfOrder(rawPoints);
  rawPoints.sort((a, b) => a.timeMs - b.timeMs);
  setTimeBounds(stats, rawPoints);
  for (const point of rawPoints) {
    maybeKeepFilteredPoint(point, cleanState, cleanedPoints, stats, options);
  }

  return {
    points: cleanedPoints,
    stats: summarizeStats(stats),
  };
}

class TimelinePathParser {
  constructor(onPath) {
    this.onPath = onPath;
    this.buffer = "";
    this.state = "search";
    this.depth = 0;
    this.objectStart = -1;
    this.index = 0;
    this.inString = false;
    this.escape = false;
  }

  push(text) {
    if (!text) return;
    this.buffer += text;
    this.scan();
  }

  finish() {
    this.scan();
  }

  scan() {
    while (this.buffer.length) {
      if (this.state === "search") {
        const keyIndex = this.buffer.indexOf(KEY);

        if (keyIndex === -1) {
          this.buffer = this.buffer.slice(-KEY.length);
          return;
        }

        const bracketIndex = this.buffer.indexOf("[", keyIndex + KEY.length);
        if (bracketIndex === -1) {
          this.buffer = this.buffer.slice(keyIndex);
          return;
        }

        this.buffer = this.buffer.slice(bracketIndex + 1);
        this.state = "array";
        this.depth = 0;
        this.objectStart = -1;
        this.index = 0;
        this.inString = false;
        this.escape = false;
      }

      if (this.state === "array") {
        const scanResult = this.scanArray();

        if (scanResult === "complete") {
          this.state = "search";
          continue;
        }

        return;
      }
    }
  }

  scanArray() {
    let consumedUntil = 0;

    for (let index = this.index; index < this.buffer.length; index += 1) {
      const char = this.buffer[index];

      if (this.inString) {
        if (this.escape) {
          this.escape = false;
        } else if (char === "\\") {
          this.escape = true;
        } else if (char === '"') {
          this.inString = false;
        }
        continue;
      }

      if (char === '"') {
        this.inString = true;
        continue;
      }

      if (char === "{") {
        if (this.depth === 0) {
          this.objectStart = index;
        }
        this.depth += 1;
        continue;
      }

      if (char === "}") {
        if (this.depth > 0) {
          this.depth -= 1;
        }

        if (this.depth === 0 && this.objectStart !== -1) {
          const objectText = this.buffer.slice(this.objectStart, index + 1);
          this.onPath(JSON.parse(objectText));
          this.objectStart = -1;
          consumedUntil = index + 1;
        }
        continue;
      }

      if (char === "]" && this.depth === 0) {
        this.buffer = this.buffer.slice(index + 1);
        this.index = 0;
        return "complete";
      }
    }

    if (this.objectStart !== -1) {
      if (this.objectStart > 0) {
        this.buffer = this.buffer.slice(this.objectStart);
        this.objectStart = 0;
      }
      this.index = this.buffer.length;
      return "pending";
    }

    if (consumedUntil > 0) {
      this.buffer = this.buffer.slice(consumedUntil);
      this.index = 0;
      return "pending";
    }

    if (this.buffer.length) {
      this.buffer = "";
      this.index = 0;
      return "pending";
    }

    return "pending";
  }
}

class CsvPointParser {
  constructor(onPoint, onInvalid) {
    this.onPoint = onPoint;
    this.onInvalid = onInvalid;
    this.buffer = "";
    this.columns = null;
  }

  push(text) {
    if (!text) return;
    this.buffer += text;
    this.consumeLines(false);
  }

  finish() {
    this.consumeLines(true);
  }

  consumeLines(isFinal) {
    let lineEnd = findLineEnd(this.buffer);

    while (lineEnd !== -1) {
      const line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + lineBreakLength(this.buffer, lineEnd));
      this.consumeLine(line);
      lineEnd = findLineEnd(this.buffer);
    }

    if (isFinal && this.buffer.trim()) {
      this.consumeLine(this.buffer);
      this.buffer = "";
    }
  }

  consumeLine(line) {
    if (!line.trim()) return;

    const values = parseCsvLine(line);

    if (!this.columns) {
      this.columns = getCsvColumns(values);
      if (!this.columns) {
        throw new Error("CSV must include lat, long, and time columns.");
      }
      return;
    }

    const point = normalizeCsvRow(values, this.columns);
    if (point) {
      this.onPoint(point);
    } else {
      this.onInvalid();
    }
  }
}

function normalizePathPoint(path) {
  if (!path?.point || !path?.time) return null;

  const coordinates = parsePoint(path.point);
  const timeMs = Date.parse(path.time);

  if (!coordinates || !Number.isFinite(timeMs)) return null;

  return {
    lat: coordinates.lat,
    lon: coordinates.lon,
    timeMs,
  };
}

function normalizeCsvRow(values, columns) {
  const lat = Number(values[columns.lat]);
  const lon = Number(values[columns.long]);
  const timeMs = parseUtcTime(values[columns.time]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(timeMs)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon, timeMs };
}

function getCsvColumns(headers) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  const lat = normalized.indexOf("lat");
  const long = normalized.indexOf("long");
  const time = normalized.indexOf("time");

  if (lat === -1 || long === -1 || time === -1) return null;

  return { lat, long, time };
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value.trim());
  return values;
}

function parseUtcTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) return Date.parse(text);

  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  return Date.parse(`${normalized}Z`);
}

function parsePoint(pointValue) {
  const match = String(pointValue).match(/(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

function createCleanState() {
  return {
    previousRaw: null,
    previousKept: null,
  };
}

function maybeKeepFilteredPoint(point, state, cleanedPoints, stats, options = {}) {
  const reason = getDateFilterReason(point?.timeMs, options);
  if (reason === "range") {
    stats.skippedDateRange += 1;
    return state;
  }
  if (reason === "exclusion") {
    stats.skippedDateExclusion += 1;
    return state;
  }
  return maybeKeepPoint(point, state, cleanedPoints, stats, options);
}

function maybeKeepPoint(point, state, cleanedPoints, stats, options) {
  if (!state.previousRaw || !state.previousKept) {
    const first = [point.lat, point.lon, point.timeMs, 0, 0, getUtcYear(point.timeMs)];
    cleanedPoints.push(first);
    state.previousRaw = point;
    state.previousKept = first;
    return state;
  }

  const rawElapsedSeconds = (point.timeMs - state.previousRaw.timeMs) / 1000;
  const rawDistanceM = haversineMeters(
    state.previousRaw.lat,
    state.previousRaw.lon,
    point.lat,
    point.lon,
  );
  const rawSpeedMs = rawElapsedSeconds > 0 ? rawDistanceM / rawElapsedSeconds : 0;
  state.previousRaw = point;

  if (rawElapsedSeconds <= 0) {
    stats.skippedInvalid += 1;
    return state;
  }

  if (rawSpeedMs < options.minSpeed) {
    stats.skippedSlow += 1;
    return state;
  }

  if (rawSpeedMs > options.maxSpeed) {
    stats.skippedFast += 1;
    return state;
  }

  const elapsedSeconds = (point.timeMs - state.previousKept[2]) / 1000;
  const distanceM = haversineMeters(state.previousKept[0], state.previousKept[1], point.lat, point.lon);
  const speedMs = elapsedSeconds > 0 ? distanceM / elapsedSeconds : 0;
  const kept = [point.lat, point.lon, point.timeMs, speedMs, distanceM, getUtcYear(point.timeMs)];
  cleanedPoints.push(kept);
  state.previousKept = kept;
  return state;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function getUtcYear(timeMs) {
  return new Date(timeMs).getUTCFullYear();
}

function countOutOfOrder(points) {
  let count = 0;

  for (let index = 1; index < points.length; index += 1) {
    if (points[index].timeMs < points[index - 1].timeMs) {
      count += 1;
    }
  }

  return count;
}

function setTimeBounds(stats, sortedPoints) {
  stats.minTimeMs = sortedPoints.length ? sortedPoints[0].timeMs : null;
  stats.maxTimeMs = sortedPoints.length ? sortedPoints.at(-1).timeMs : null;
}

function findLineEnd(text) {
  const newline = text.indexOf("\n");
  const carriage = text.indexOf("\r");

  if (newline === -1) return carriage;
  if (carriage === -1) return newline;
  return Math.min(newline, carriage);
}

function lineBreakLength(text, lineEnd) {
  return text[lineEnd] === "\r" && text[lineEnd + 1] === "\n" ? 2 : 1;
}

function createStats(fileSize) {
  return {
    fileSize,
    bytesRead: 0,
    rawCount: 0,
    skippedSlow: 0,
    skippedFast: 0,
    skippedDateRange: 0,
    skippedDateExclusion: 0,
    skippedInvalid: 0,
    outOfOrderCount: 0,
    minTimeMs: null,
    maxTimeMs: null,
  };
}

function summarizeStats(stats) {
  return {
    rawCount: stats.rawCount,
    skippedSlow: stats.skippedSlow,
    skippedFast: stats.skippedFast,
    skippedDateRange: stats.skippedDateRange,
    skippedDateExclusion: stats.skippedDateExclusion,
    skippedInvalid: stats.skippedInvalid,
    outOfOrderCount: stats.outOfOrderCount,
    minTimeMs: stats.minTimeMs,
    maxTimeMs: stats.maxTimeMs,
  };
}

function postProgress(stats, keptCount) {
  if (typeof self === "undefined" || typeof self.postMessage !== "function") return;
  self.postMessage({
    type: "progress",
    percent: stats.fileSize ? (stats.bytesRead / stats.fileSize) * 100 : 0,
    rawCount: stats.rawCount,
    keptCount,
  });
}

export {
  TimelinePathParser,
  createCleanState,
  normalizePathPoint,
  normalizeCsvRow,
  parseCsvFile,
  parseCsvLine,
  parseJsonFile,
  maybeKeepFilteredPoint,
  maybeKeepPoint,
  setTimeBounds,
  haversineMeters,
};
