import test from "node:test";
import assert from "node:assert/strict";
import { getLayerTravelSummary } from "../src/layer-summary.js";

test("summarizes cleaned layer distance and duration using display units", () => {
  const summary = getLayerTravelSummary([
    [0, 0, 0, 0, 0],
    [0, 1, 12 * 60 * 60_000, 0, 1609.344],
    [0, 2, 36 * 60 * 60_000, 0, 1609.344],
  ], "mph");

  assert.equal(summary.distanceM, 3218.688);
  assert.equal(summary.durationMs, 36 * 60 * 60_000);
  assert.equal(summary.text, "distance 2 miles · duration 36 hours");
});

test("returns no travel summary until a layer has cleaned points", () => {
  assert.equal(getLayerTravelSummary([], "kmh"), null);
});
