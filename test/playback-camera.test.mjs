import test from "node:test";
import assert from "node:assert/strict";
import {
  RevealedPathBounds,
  getFitCameraTarget,
  getPredictedSourceElapsedMs,
  smoothCamera,
} from "../src/playback-camera.js";
import { buildPlaybackSequence, samplePlaybackAt } from "../src/playback-model.js";

test("tracks only the revealed path and resets when playback moves backward", () => {
  const sequence = makeSequence([[0, 0, 0], [10, 10, 1000], [20, 20, 2000]]);
  const tracker = new RevealedPathBounds();
  const halfway = tracker.update(sequence, samplePlaybackAt(sequence, 1000));
  assert.equal(halfway.maxLat, 10);
  assert.equal(halfway.maxLon, 10);

  const finished = tracker.update(sequence, samplePlaybackAt(sequence, 2000));
  assert.equal(finished.maxLat, 20);

  const reset = tracker.update(sequence, samplePlaybackAt(sequence, 0));
  assert.equal(reset.minLat, 0);
  assert.equal(reset.maxLat, 0);
});

test("keeps dateline-crossing bounds narrow", () => {
  const sequence = makeSequence([[0, 179, 0], [0, -179, 1000]]);
  const tracker = new RevealedPathBounds();
  const bounds = tracker.update(sequence, samplePlaybackAt(sequence, 1000));
  assert.equal(bounds.longitudeSpan, 2);
  assert.equal(Math.abs(Math.abs((bounds.minLon + bounds.maxLon) / 2) - 180) < 1e-9, true);
});

test("fits full source geometry when only tracking is resampled", () => {
  const sequence = makeSequence([[0, 0, 0], [10, 10, 100], [0, 20, 1000]], 1000);
  const snapshot = samplePlaybackAt(sequence, 1000);
  const resampledBounds = new RevealedPathBounds().update(sequence, snapshot);
  const sourceBounds = new RevealedPathBounds().update(sequence, snapshot, { pathMode: "tracking-only" });
  assert.equal(resampledBounds.maxLat, 0);
  assert.equal(sourceBounds.maxLat, 10);
});

test("uses starting zoom for a point and zooms out for a growing path and margin", () => {
  const point = { minLat: 1, maxLat: 1, minLon: 2, maxLon: 2 };
  const baseOptions = {
    width: 1000,
    height: 600,
    marginPx: 40,
    startingZoom: 14,
    viewMode: "flat",
    minZoom: 2,
    maxZoom: 18,
    tileSize: 256,
  };
  assert.equal(getFitCameraTarget(point, baseOptions).zoom, 14);

  const path = { minLat: 0, maxLat: 20, minLon: 0, maxLon: 20 };
  const fit = getFitCameraTarget(path, baseOptions);
  const buffered = getFitCameraTarget(path, { ...baseOptions, marginPx: 200 });
  assert.ok(fit.zoom < 14);
  assert.ok(buffered.zoom < fit.zoom);
});

test("smooths camera motion with a frame-rate-independent time constant", () => {
  const current = { lat: 0, lon: 179, zoom: 10 };
  const target = { lat: 10, lon: -179, zoom: 6 };
  const smoothed = smoothCamera(current, target, 1000, 1);
  const expectedAlpha = 1 - Math.exp(-1);
  assert.ok(Math.abs(smoothed.lat - 10 * expectedAlpha) < 1e-9);
  assert.ok(smoothed.lon > 179 || smoothed.lon < -179);
  assert.ok(smoothed.zoom < 10 && smoothed.zoom > 6);
  assert.deepEqual(smoothCamera(current, target, 16, 0), target);
});

test("predicts camera bounds by one smoothing horizon in playback time", () => {
  assert.equal(getPredictedSourceElapsedMs(10_000, 100_000, 20, 0.5), 20_000);
  assert.equal(getPredictedSourceElapsedMs(95_000, 100_000, 20, 0.5), 100_000);
  assert.equal(getPredictedSourceElapsedMs(10_000, 100_000, 20, 0), 10_000);
});

function makeSequence(points, intervalMs = 500) {
  return buildPlaybackSequence([{
    id: 1,
    status: "ready",
    color: "#2563eb",
    size: 2,
    cleanedPoints: points,
  }], intervalMs);
}
