import test from "node:test";
import assert from "node:assert/strict";
import { buildPlaybackSequence, samplePlaybackAt } from "../src/playback-model.js";
import { PlaybackCanvasLayer } from "../src/playback-renderer.js";

test("draws preview, completed route, and marker in flat and globe modes", () => {
  const sequence = buildPlaybackSequence(
    [{
      id: 1,
      status: "ready",
      color: "#2563eb",
      size: 2,
      cleanedPoints: [[0, 0, 0], [1, 1, 1000], [2, 2, 2000]],
    }],
    500,
  );
  const layer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0.3 });
  layer.setSnapshot(samplePlaybackAt(sequence, 750));
  const operations = [];
  const context = makeContext(operations);
  const map = makeMap();

  layer.draw(context, map);
  layer.drawGlobe(context, map, {});

  assert.ok(operations.includes("stroke"));
  assert.ok(operations.includes("fill"));
  assert.ok(operations.includes("arc"));
});

test("can smooth tracking while retaining full source path geometry", () => {
  const sequence = buildPlaybackSequence(
    [{
      id: 1,
      status: "ready",
      color: "#2563eb",
      size: 2,
      cleanedPoints: [[0, 0, 0], [10, 10, 100], [0, 20, 1000]],
    }],
    1000,
  );
  const snapshot = samplePlaybackAt(sequence, 1000);
  const fullPathEdges = [];
  const trackingEdges = [];
  const fullPathLayer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "tracking-only" });
  const trackingLayer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "resampled" });
  fullPathLayer.setSnapshot(snapshot);
  trackingLayer.setSnapshot(snapshot);

  fullPathLayer.draw(makeContext([]), makeMap(fullPathEdges));
  trackingLayer.draw(makeContext([]), makeMap(trackingEdges));

  assert.ok(fullPathEdges.length > 2);
  assert.ok(fullPathEdges.some((edge) => pointsAlmostEqual(edge[1], [10, 10])));
  assert.ok(pointsAlmostEqual(fullPathEdges[0][0], [0, 0]));
  assert.ok(pointsAlmostEqual(fullPathEdges.at(-1)[1], [0, 20]));
  assert.ok(trackingEdges.length > 1);
  assert.ok(trackingEdges.every((edge) => Math.abs(edge[0][0]) < 1e-9 && Math.abs(edge[1][0]) < 1e-9));
  assert.ok(pointsAlmostEqual(trackingEdges[0][0], [0, 0]));
  assert.ok(pointsAlmostEqual(trackingEdges.at(-1)[1], [0, 20]));
});

test("renders mid-length source edges as cubic Bezier curves", () => {
  const sequence = buildPlaybackSequence(
    [{
      id: 1,
      status: "ready",
      color: "#2563eb",
      size: 2,
      cleanedPoints: [[0, 0, 0], [0.2, 0.4, 500], [0.1, 0.8, 1000]],
    }],
    1000,
  );
  const curves = [];
  const layer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "tracking-only" });
  layer.setSnapshot(samplePlaybackAt(sequence, 1000, { pathMode: "tracking-only" }));
  layer.draw(makeContext([], [], curves), makeMap());

  assert.equal(curves.length, 2);
  assert.ok(pointsAlmostEqual(curves.at(-1).at(-1), [0.1, 0.8]));
});

test("keeps the full-definition reveal connected to the smoothed marker", () => {
  const sequence = buildPlaybackSequence(
    [{
      id: 1,
      status: "ready",
      color: "#2563eb",
      size: 2,
      cleanedPoints: [[0, 0, 0], [0, 1, 100], [1, 1, 1000]],
    }],
    1000,
  );
  const snapshot = samplePlaybackAt(sequence, 400, { pathMode: "tracking-only" });
  const edges = [];
  const markers = [];
  const curves = [];
  const layer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "tracking-only" });
  layer.setSnapshot(snapshot);
  layer.draw(makeContext([], markers, curves), makeMap(edges));

  const lineHead = curves.length ? curves.at(-1).at(-1) : edges.at(-1)[1];
  assert.ok(Math.abs(lineHead[0] - markers[0][0]) < 1e-9);
  assert.ok(Math.abs(lineHead[1] - markers[0][1]) < 1e-9);
});

test("keeps a partially revealed great-circle path connected to its marker", () => {
  const sequence = buildPlaybackSequence(
    [{
      id: 1,
      status: "ready",
      color: "#2563eb",
      size: 2,
      cleanedPoints: [[0, 0, 0], [10, 10, 1000]],
    }],
    1000,
  );
  const snapshot = samplePlaybackAt(sequence, 400);
  const edges = [];
  const markers = [];
  const layer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "resampled" });
  layer.setSnapshot(snapshot);
  layer.draw(makeContext([], markers), makeMap(edges));

  const lineHead = edges.at(-1)[1];
  assert.ok(pointsAlmostEqual(lineHead, markers[0]));
});

function makeContext(operations, markers = [], curves = []) {
  return {
    beginPath: () => operations.push("beginPath"),
    moveTo: () => operations.push("moveTo"),
    lineTo: () => operations.push("lineTo"),
    bezierCurveTo: (control1X, control1Y, control2X, control2Y, endX, endY) => {
      operations.push("bezierCurveTo");
      curves.push([
        [control1Y, control1X],
        [control2Y, control2X],
        [endY, endX],
      ]);
    },
    stroke: () => operations.push("stroke"),
    arc: (x, y) => {
      operations.push("arc");
      markers.push([y, x]);
    },
    fill: () => operations.push("fill"),
    save: () => operations.push("save"),
    restore: () => operations.push("restore"),
    set lineWidth(value) {},
    set lineJoin(value) {},
    set lineCap(value) {},
    set strokeStyle(value) {},
    set fillStyle(value) {},
    set globalAlpha(value) {},
  };
}

function pointsAlmostEqual(first, second, epsilon = 1e-9) {
  return Math.abs(first[0] - second[0]) < epsilon && Math.abs(first[1] - second[1]) < epsilon;
}

function makeMap(edges = []) {
  return {
    segmentIntersectsView(start, end) {
      edges.push([start, end]);
      return {
        visible: true,
        start: { x: start[1], y: start[0] },
        end: { x: end[1], y: end[0] },
      };
    },
    latLonToContainerPoint(lat, lon) {
      return { x: lon, y: lat };
    },
    latLonToGlobePoint(lat, lon) {
      return { x: lon, y: lat, visible: true };
    },
  };
}
