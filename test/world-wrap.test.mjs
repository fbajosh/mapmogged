import test from "node:test";
import assert from "node:assert/strict";
import { createRouteEdge } from "../src/route-geometry.js";
import { drawRouteEdgeFlat } from "../src/route-canvas.js";
import { alignWrappedX, getVisibleWorldShifts } from "../src/world-wrap.js";

const WORLD_SIZE = 1000;
const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 500;

test("aligns a wrapped point with the nearest copy of its reference", () => {
  assert.equal(alignWrappedX(1, 999, WORLD_SIZE), 1001);
  assert.equal(alignWrappedX(999, 1, WORLD_SIZE), -1);
  assert.deepEqual(
    getVisibleWorldShifts(
      [{ x: 999, y: 250 }, { x: 1001, y: 250 }],
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      WORLD_SIZE,
      64,
    ),
    [-1000, 0],
  );
});

test("draws a short dateline crossing at both map edges without a world-spanning line", () => {
  const edge = createRouteEdge(
    null,
    { lat: 0, lon: 179.98 },
    { lat: 0, lon: -179.98 },
    null,
  );
  const lines = [];

  assert.equal(drawRouteEdgeFlat(makeContext(lines), makeMap(), edge), true);
  assert.equal(lines.length, 2);
  assert.ok(lines.every(([start, end]) => Math.abs(end.x - start.x) < 1));
  assert.ok(lines.some(([start, end]) => Math.min(start.x, end.x) < 0));
  assert.ok(lines.some(([start, end]) => Math.max(start.x, end.x) > VIEWPORT_WIDTH));
});

test("keeps Bezier and great-circle routes continuous across the dateline", () => {
  const bezier = createRouteEdge(
    null,
    { lat: 5, lon: 179.9 },
    { lat: 5.05, lon: -179.9 },
    null,
  );
  const greatCircle = createRouteEdge(
    null,
    { lat: 10, lon: 179 },
    { lat: 10, lon: -179 },
    null,
  );
  const curves = [];
  const lines = [];
  const context = makeContext(lines, curves);
  const map = makeMap();

  assert.equal(drawRouteEdgeFlat(context, map, bezier), true);
  assert.equal(curves.length, 2);
  assert.ok(curves.every((curve) => Math.max(...curve.map((point) => point.x)) - Math.min(...curve.map((point) => point.x)) < 2));

  assert.equal(drawRouteEdgeFlat(context, map, greatCircle), true);
  assert.ok(lines.length > 0);
  assert.ok(lines.every(([start, end]) => Math.abs(end.x - start.x) < 2));
  assert.ok(lines.some(([start, end]) => Math.min(start.x, end.x) < 1));
  assert.ok(lines.some(([start, end]) => Math.max(start.x, end.x) > VIEWPORT_WIDTH - 1));
});

function makeMap() {
  const map = {
    container: { clientWidth: VIEWPORT_WIDTH, clientHeight: VIEWPORT_HEIGHT },
    getWorldPixelSize: () => WORLD_SIZE,
    latLonToContainerPoint(lat, lon, referenceX = null) {
      const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
      const baseX = ((wrappedLon + 180) / 360) * WORLD_SIZE;
      return {
        x: Number.isFinite(referenceX) ? alignWrappedX(baseX, referenceX, WORLD_SIZE) : baseX,
        y: VIEWPORT_HEIGHT / 2 - lat,
      };
    },
    getVisibleWorldShifts(points, pad) {
      return getVisibleWorldShifts(
        points,
        VIEWPORT_WIDTH,
        VIEWPORT_HEIGHT,
        WORLD_SIZE,
        pad,
      );
    },
    segmentIntersectsView(startPoint, endPoint, pad) {
      const start = this.latLonToContainerPoint(startPoint[0], startPoint[1]);
      const end = this.latLonToContainerPoint(endPoint[0], endPoint[1], start.x);
      const segments = this.getVisibleWorldShifts([start, end], pad).map((shift) => ({
        start: { x: start.x + shift, y: start.y },
        end: { x: end.x + shift, y: end.y },
      }));
      return {
        start: segments[0]?.start ?? start,
        end: segments[0]?.end ?? end,
        segments,
        visible: segments.length > 0,
      };
    },
  };
  return map;
}

function makeContext(lines, curves = []) {
  let current = null;
  return {
    moveTo(x, y) {
      current = { x, y };
    },
    lineTo(x, y) {
      const end = { x, y };
      lines.push([current, end]);
      current = end;
    },
    bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY) {
      const end = { x: endX, y: endY };
      curves.push([
        current,
        { x: control1X, y: control1Y },
        { x: control2X, y: control2Y },
        end,
      ]);
      current = end;
    },
  };
}
