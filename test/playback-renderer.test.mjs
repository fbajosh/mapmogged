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

  assert.deepEqual(fullPathEdges, [
    [[0, 0], [10, 10]],
    [[10, 10], [0, 20]],
  ]);
  assert.deepEqual(trackingEdges, [
    [[0, 0], [0, 20]],
  ]);
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
  const layer = new PlaybackCanvasLayer(sequence, { previewAlpha: 0, pathMode: "tracking-only" });
  layer.setSnapshot(snapshot);
  layer.draw(makeContext([], markers), makeMap(edges));

  const lineHead = edges.at(-1)[1];
  assert.ok(Math.abs(lineHead[0] - markers[0][0]) < 1e-9);
  assert.ok(Math.abs(lineHead[1] - markers[0][1]) < 1e-9);
});

function makeContext(operations, markers = []) {
  return {
    beginPath: () => operations.push("beginPath"),
    moveTo: () => operations.push("moveTo"),
    lineTo: () => operations.push("lineTo"),
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
