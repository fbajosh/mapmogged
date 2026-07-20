import test from "node:test";
import assert from "node:assert/strict";
import {
  TimelinePathParser,
  createCleanState,
  haversineMeters,
  maybeKeepFilteredPoint,
  maybeKeepPoint,
  normalizeCsvRow,
  normalizePathPoint,
  parseCsvFile,
  parseCsvLine,
  parseJsonFile,
  setTimeBounds,
} from "../src/timeline-worker.js";

test("extracts timelinePath entries across chunks", () => {
  const paths = [];
  const parser = new TimelinePathParser((path) => paths.push(path));

  parser.push('{"semanticSegments":[{"timelinePath":[{"point":"33.1°, -84.1°","time":"2020-01-01T00:00:00.000Z"},');
  parser.push('{"point":"33.2°, -84.2°","time":"2020-01-01T00:10:00.000Z"}]}]}');
  parser.finish();

  assert.equal(paths.length, 2);
  assert.equal(paths[0].point, "33.1°, -84.1°");
  assert.equal(paths[1].time, "2020-01-01T00:10:00.000Z");
});

test("normalizes Google point and time values", () => {
  const point = normalizePathPoint({
    point: "33.7751363°, -84.396219°",
    time: "2013-02-28T16:52:00.000-05:00",
  });

  assert.equal(point.lat, 33.7751363);
  assert.equal(point.lon, -84.396219);
  assert.equal(new Date(point.timeMs).toISOString(), "2013-02-28T21:52:00.000Z");
});

test("parses CSV lines with quoted values", () => {
  assert.deepEqual(parseCsvLine('time,long,lat,note'), ["time", "long", "lat", "note"]);
  assert.deepEqual(parseCsvLine('"2024-01-01 00:00:00",-84.1,33.1,"a,b"'), [
    "2024-01-01 00:00:00",
    "-84.1",
    "33.1",
    "a,b",
  ]);
});

test("normalizes CSV rows with UTC timestamps", () => {
  const point = normalizeCsvRow(["33.1", "-84.1", "2024-01-01 00:00:00"], {
    lat: 0,
    long: 1,
    time: 2,
  });

  assert.equal(point.lat, 33.1);
  assert.equal(point.lon, -84.1);
  assert.equal(new Date(point.timeMs).toISOString(), "2024-01-01T00:00:00.000Z");
});

test("returns full timestamp bounds from completed CSV and JSON parsing", async () => {
  const csv = new Blob([
    "lat,long,time\n",
    "33.1,-84.1,2024-01-01T00:00:00Z\n",
    "33.2,-84.2,2024-12-31T23:59:59Z\n",
  ]);
  const json = new Blob([JSON.stringify({
    semanticSegments: [{
      timelinePath: [
        { point: "33.1°, -84.1°", time: "2024-01-01T00:00:00Z" },
        { point: "33.2°, -84.2°", time: "2024-12-31T23:59:59Z" },
      ],
    }],
  })]);
  const options = { minSpeed: 0, maxSpeed: 500 };

  for (const result of [await parseCsvFile(csv, options), await parseJsonFile(json, options)]) {
    assert.equal(result.stats.minTimeMs, Date.parse("2024-01-01T00:00:00Z"));
    assert.equal(result.stats.maxTimeMs, Date.parse("2024-12-31T23:59:59Z"));
  }
});

test("keeps threshold-crossing points and skips slow drift", () => {
  const stats = makeStats();
  const options = { minSpeed: 0.5, maxSpeed: 500 };
  const cleaned = [];
  const state = createCleanState();

  maybeKeepPoint(makePoint(0, 0, 0), state, cleaned, stats, options);
  maybeKeepPoint(makePoint(0, 0.00001, 10_000), state, cleaned, stats, options);
  maybeKeepPoint(makePoint(0, 0.001, 20_000), state, cleaned, stats, options);

  assert.equal(cleaned.length, 2);
  assert.equal(stats.skippedSlow, 1);
  assert.ok(state.previousKept[3] > 0.5);
});

test("skips impossible jumps above the max speed", () => {
  const stats = makeStats();
  const options = { minSpeed: 0.5, maxSpeed: 500 };
  const cleaned = [];
  const state = createCleanState();

  maybeKeepPoint(makePoint(0, 0, 0), state, cleaned, stats, options);
  maybeKeepPoint(makePoint(20, 20, 1000), state, cleaned, stats, options);

  assert.equal(cleaned.length, 1);
  assert.equal(stats.skippedFast, 1);
  assert.equal(state.previousKept[0], 0);
});

test("applies date cropping and exclusions before speed cleaning", () => {
  const stats = makeStats();
  const options = {
    minSpeed: 0,
    maxSpeed: 500,
    dateRangeStartMs: 1000,
    dateRangeEndMs: 4000,
    dateExclusions: [{ startMs: 2000, endMs: 3000 }],
  };
  const cleaned = [];
  const state = createCleanState();

  for (const timeMs of [0, 1000, 2000, 3000, 4000, 5000]) {
    maybeKeepFilteredPoint(makePoint(0, timeMs / 1_000_000, timeMs), state, cleaned, stats, options);
  }

  assert.deepEqual(cleaned.map((point) => point[2]), [1000, 4000]);
  assert.equal(stats.skippedDateRange, 2);
  assert.equal(stats.skippedDateExclusion, 2);
});

test("reports the full valid dataset time bounds before filtering", () => {
  const stats = makeStats();
  setTimeBounds(stats, [makePoint(0, 0, 1000), makePoint(0, 0, 5000)]);
  assert.equal(stats.minTimeMs, 1000);
  assert.equal(stats.maxTimeMs, 5000);
});

test("calculates Haversine distance in meters", () => {
  const distance = haversineMeters(0, 0, 0, 1);
  assert.ok(distance > 111_000);
  assert.ok(distance < 112_000);
});

function makePoint(lat, lon, timeMs) {
  return { lat, lon, timeMs };
}

function makeStats() {
  return {
    rawCount: 0,
    skippedSlow: 0,
    skippedFast: 0,
    skippedDateRange: 0,
    skippedDateExclusion: 0,
    skippedInvalid: 0,
  };
}
