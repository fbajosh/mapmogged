import test from "node:test";
import assert from "node:assert/strict";
import {
  createColorRamp,
  getTimeGradientBin,
  getTimeGradientColor,
  resolvePointTimeBounds,
  visitTimeGradientBands,
} from "../src/time-gradient.js";

test("interpolates a color ramp from the first color to the second", () => {
  const ramp = createColorRamp("#000000", "#ffffff", 3);
  assert.deepEqual(ramp, ["#000000", "#808080", "#ffffff"]);
  assert.equal(getTimeGradientColor(ramp, 0, 0, 100), "#000000");
  assert.equal(getTimeGradientColor(ramp, 50, 0, 100), "#808080");
  assert.equal(getTimeGradientColor(ramp, 100, 0, 100), "#ffffff");
});

test("assigns timestamps to stable gradient bands", () => {
  assert.equal(getTimeGradientBin(-10, 0, 100, 5), 0);
  assert.equal(getTimeGradientBin(50, 0, 100, 5), 2);
  assert.equal(getTimeGradientBin(110, 0, 100, 5), 4);
});

test("splits a sparse edge across every crossed gradient band", () => {
  const pieces = [];
  visitTimeGradientBands(0, 100, 0, 100, (startRatio, endRatio, colorIndex) => {
    pieces.push({ startRatio, endRatio, colorIndex });
  }, 5);

  assert.equal(pieces.length, 5);
  assert.deepEqual(pieces.map((piece) => piece.colorIndex), [0, 1, 2, 3, 4]);
  assert.equal(pieces[0].startRatio, 0);
  assert.equal(pieces.at(-1).endRatio, 1);
});

test("finds the full timestamp extent of point data", () => {
  assert.deepEqual(resolvePointTimeBounds([[0, 0, 30], [0, 0, 10], [0, 0, 20]]), {
    startMs: 10,
    endMs: 30,
  });
});
