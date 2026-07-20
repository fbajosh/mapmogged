import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTE_EDGE_BEZIER,
  ROUTE_EDGE_GREAT_CIRCLE,
  ROUTE_EDGE_STRAIGHT,
  classifyRouteEdge,
  createRouteEdge,
  getPartialRouteEdge,
  getRouteEdgeBoundsPoints,
  interpolateRouteEdge,
} from "../src/route-geometry.js";

test("classifies short, smooth, and great-circle edges by angular distance", () => {
  assert.equal(classifyRouteEdge([0, 0], [0, 0.05]), ROUTE_EDGE_STRAIGHT);
  assert.equal(classifyRouteEdge([0, 0], [0, 0.5]), ROUTE_EDGE_BEZIER);
  assert.equal(classifyRouteEdge([0, 0], [0, 2]), ROUTE_EDGE_GREAT_CIRCLE);
});

test("creates a cubic curve that passes through its observed endpoints", () => {
  const edge = createRouteEdge(
    [-0.4, 0],
    [0, 0.4],
    [0.4, 0.8],
    [0.2, 1.2],
  );
  assert.equal(edge.kind, ROUTE_EDGE_BEZIER);
  const start = interpolateRouteEdge(edge, 0);
  assert.ok(Math.abs(start.lat) < 1e-12);
  assert.ok(Math.abs(start.lon - 0.4) < 1e-12);
  const end = interpolateRouteEdge(edge, 1);
  assert.ok(Math.abs(end.lat - 0.4) < 1e-12);
  assert.ok(Math.abs(end.lon - 0.8) < 1e-12);
  const midpoint = interpolateRouteEdge(edge, 0.5);
  assert.ok(midpoint.lat > 0.2);
});

test("uses spherical interpolation for long edges and crosses the dateline narrowly", () => {
  const edge = createRouteEdge(null, [0, 179], [0, -179], null);
  assert.equal(edge.kind, ROUTE_EDGE_GREAT_CIRCLE);
  const midpoint = interpolateRouteEdge(edge, 0.5);
  assert.ok(Math.abs(Math.abs(midpoint.lon) - 180) < 1e-9);
  assert.ok(Math.abs(midpoint.lat) < 1e-9);

  const diagonal = createRouteEdge(null, [0, 0], [60, 90], null);
  assert.ok(interpolateRouteEdge(diagonal, 0.5).lat > 30);
});

test("partial curves terminate at the same interpolated location", () => {
  const edge = createRouteEdge([-0.4, 0], [0, 0.4], [0.4, 0.8], [0.2, 1.2]);
  const expected = interpolateRouteEdge(edge, 0.35);
  const partial = getPartialRouteEdge(edge, 0.35);
  const actual = interpolateRouteEdge(partial, 1);
  assert.ok(Math.abs(actual.lat - expected.lat) < 1e-12);
  assert.ok(Math.abs(actual.lon - expected.lon) < 1e-12);
  assert.equal(getRouteEdgeBoundsPoints(partial).length, 4);
});
