import test from "node:test";
import assert from "node:assert/strict";
import {
  PlaybackSampleLimitError,
  buildPlaybackSequence,
  deriveMultiplier,
  derivePlaybackDuration,
  durationValueToMs,
  formatDistance,
  formatElapsed,
  formatLocalDate,
  getPreferredDurationUnit,
  samplePlaybackAt,
} from "../src/playback-model.js";

test("derives playback duration and multiplier", () => {
  const oneDay = 86_400_000;
  assert.equal(derivePlaybackDuration(oneDay, 1440), 60_000);
  assert.equal(deriveMultiplier(oneDay, 30_000), 2880);
  assert.equal(durationValueToMs(2, "hours"), 7_200_000);
  assert.equal(getPreferredDurationUnit(60_000), "minutes");
  assert.equal(getPreferredDurationUnit(30_000), "seconds");
});

test("builds layers sequentially without cross-layer distance", () => {
  const sequence = buildPlaybackSequence(
    [
      makeLayer(1, [[0, 0, 0], [0, 1, 1000]]),
      makeLayer(2, [[40, 40, 0], [40, 41, 1000]]),
    ],
    500,
  );

  assert.equal(sequence.segments.length, 2);
  assert.equal(sequence.sourceDurationMs, 2000);
  assert.equal(sequence.segments[1].sequenceStartMs, 1000);
  assert.ok(sequence.totalDistanceM < 200_000);
  assert.equal(samplePlaybackAt(sequence, 1000).layerId, 2);
});

test("resamples endpoints and interpolates at playback time", () => {
  const sequence = buildPlaybackSequence([makeLayer(1, [[0, 0, 0], [10, 10, 1000]])], 400);
  const segment = sequence.segments[0];
  assert.equal(segment.sampleCount, 4);
  assert.equal(segment.samples[2], 0);
  assert.equal(segment.samples[(segment.sampleCount - 1) * 4 + 2], 1000);

  const sample = samplePlaybackAt(sequence, 500);
  assert.ok(Math.abs(sample.lat - 5) < 0.001);
  assert.ok(Math.abs(sample.lon - 5) < 0.001);
});

test("preserves original path geometry separately from tracking samples", () => {
  const sequence = buildPlaybackSequence(
    [makeLayer(1, [[0, 0, 0], [10, 10, 100], [0, 20, 1000]])],
    1000,
  );
  const segment = sequence.segments[0];
  assert.equal(segment.sampleCount, 2);
  assert.equal(segment.sourceSampleCount, 3);
  assert.deepEqual(Array.from(segment.sourceSamples.slice(4, 6)), [10, 10]);
  assert.equal(sequence.sourcePointCount, 3);
});

test("projects smoothed tracking progress onto the full source path", () => {
  const sequence = buildPlaybackSequence(
    [makeLayer(1, [[0, 0, 0], [0, 1, 100], [1, 1, 1000]])],
    1000,
  );
  const simplified = samplePlaybackAt(sequence, 400);
  const fullPath = samplePlaybackAt(sequence, 400, { pathMode: "tracking-only" });
  assert.ok(Math.abs(simplified.lat - 0.4) < 0.001);
  assert.ok(Math.abs(simplified.lon - 0.4) < 0.001);
  assert.ok(Math.abs(fullPath.lat) < 0.001);
  assert.ok(Math.abs(fullPath.lon - 0.8) < 0.002);
  assert.equal(fullPath.localDistanceM, simplified.localDistanceM);
});

test("keeps the later coordinate for duplicate timestamps", () => {
  const sequence = buildPlaybackSequence(
    [makeLayer(1, [[0, 0, 0], [1, 1, 0], [2, 2, 1000]])],
    1000,
  );
  assert.equal(sequence.segments[0].samples[0], 1);
  assert.equal(sequence.segments[0].samples[1], 1);
});

test("interpolates longitude across the dateline", () => {
  const sequence = buildPlaybackSequence([makeLayer(1, [[0, 179, 0], [0, -179, 1000]])], 500);
  const midpoint = samplePlaybackAt(sequence, 500);
  assert.ok(Math.abs(Math.abs(midpoint.lon) - 180) < 0.001);
});

test("rejects sample counts above the cap", () => {
  let error;
  try {
    buildPlaybackSequence([makeLayer(1, [[0, 0, 0], [0, 1, 10_000]])], 1000, { maxSamples: 3 });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof PlaybackSampleLimitError);
  assert.doesNotThrow(() =>
    buildPlaybackSequence([makeLayer(1, [[0, 0, 0], [0, 1, 10_000]])], error.minimumIntervalMs, {
      maxSamples: 3,
    }),
  );
});

test("formats distance, elapsed boundaries, and local timestamps", () => {
  assert.deepEqual(formatDistance(1609.344, "mph"), { value: 1, unit: "mi", text: "1" });
  assert.equal(formatDistance(1000, "kmh").unit, "km");
  assert.equal(formatDistance(1852, "knots").text, "1");
  assert.equal(formatDistance(1499, "kmh").text, "1");
  assert.equal(formatElapsed(59 * 60_000).unit, "minutes");
  assert.equal(formatElapsed(60 * 60_000).unit, "hours");
  assert.equal(formatElapsed(24 * 60 * 60_000).unit, "days");
  assert.equal(formatElapsed(33.3 * 24 * 60 * 60_000).text, "33");
  assert.equal(formatElapsed(365 * 24 * 60 * 60_000).unit, "years");
  const localDate = new Date(2026, 2, 7, 15, 0);
  assert.equal(formatLocalDate(localDate.getTime()), "March 7");
});

function makeLayer(id, points) {
  return {
    id,
    status: "ready",
    color: "#2563eb",
    size: 2,
    cleanedPoints: points.map(([lat, lon, timeMs]) => [lat, lon, timeMs, 0, 0, 1970]),
  };
}
