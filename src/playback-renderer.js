import { SAMPLE_STRIDE, samplePathAtDistance } from "./playback-model.js";
import { createRouteEdge } from "./route-geometry.js";
import { drawRouteEdgeFlat, drawRouteEdgeGlobe } from "./route-canvas.js";

const MAX_DRAWN_SAMPLES_PER_PASS = 50_000;

class PlaybackCanvasLayer {
  constructor(sequence, options = {}) {
    this.sequence = sequence;
    this.previewAlpha = options.previewAlpha ?? 0.3;
    this.pathMode = options.pathMode === "tracking-only" ? "tracking-only" : "resampled";
    this.snapshot = null;
    this.pointCount = sequence?.sampleCount ?? 0;
  }

  setSnapshot(snapshot) {
    this.snapshot = snapshot;
  }

  setPreviewAlpha(alpha) {
    this.previewAlpha = alpha === 0 ? 0 : 0.3;
  }

  setPathMode(pathMode) {
    this.pathMode = pathMode === "tracking-only" ? "tracking-only" : "resampled";
  }

  draw(ctx, map) {
    if (!this.snapshot || !this.sequence?.segments?.length) return;
    if (this.previewAlpha > 0) {
      for (const segment of this.sequence.segments) {
        const path = getSegmentPath(segment, this.pathMode);
        drawFlatSegment(ctx, map, segment, path, path.sampleCount - 1, this.previewAlpha);
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawFlatSegment(ctx, map, segment, path, path.sampleCount - 1, 0.9);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    drawFlatSegment(ctx, map, active, revealed, revealed.endIndex, 0.9, revealed.edgeRatio);
    drawFlatMarker(ctx, map, active, this.snapshot);
    ctx.globalAlpha = 1;
  }

  drawGlobe(ctx, map, geometry) {
    if (!this.snapshot || !this.sequence?.segments?.length) return;
    if (this.previewAlpha > 0) {
      for (const segment of this.sequence.segments) {
        const path = getSegmentPath(segment, this.pathMode);
        drawGlobeSegment(ctx, map, geometry, segment, path, path.sampleCount - 1, this.previewAlpha);
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawGlobeSegment(ctx, map, geometry, segment, path, path.sampleCount - 1, 0.9);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    drawGlobeSegment(ctx, map, geometry, active, revealed, revealed.endIndex, 0.9, revealed.edgeRatio);
    drawGlobeMarker(ctx, map, geometry, active, this.snapshot);
    ctx.globalAlpha = 1;
  }
}

function drawFlatSegment(ctx, map, segment, path, endIndex, alpha, edgeRatio = 0) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha);
  const step = getDrawStep(endIndex + 1);
  ctx.beginPath();
  let drawing = drawCompleteEdges(
    path,
    endIndex,
    step,
    (edge) => drawRouteEdgeFlat(ctx, map, edge, 1, 24),
  );
  if (edgeRatio > 0 && endIndex < path.sampleCount - 1) {
    const edge = getPackedRouteEdge(path, endIndex);
    drawing = drawRouteEdgeFlat(ctx, map, edge, edgeRatio, 24) || drawing;
  }
  if (drawing) ctx.stroke();
}

function drawGlobeSegment(ctx, map, geometry, segment, path, endIndex, alpha, edgeRatio = 0) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha);
  const step = getDrawStep(endIndex + 1);
  ctx.beginPath();
  let drawing = drawCompleteEdges(
    path,
    endIndex,
    step,
    (edge) => drawRouteEdgeGlobe(ctx, map, geometry, edge, 1, Number(segment.width) + 4),
  );
  if (edgeRatio > 0 && endIndex < path.sampleCount - 1) {
    const edge = getPackedRouteEdge(path, endIndex);
    drawing = drawRouteEdgeGlobe(
      ctx,
      map,
      geometry,
      edge,
      edgeRatio,
      Number(segment.width) + 4,
    ) || drawing;
  }
  if (drawing) ctx.stroke();
}

function drawCompleteEdges(path, endIndex, step, drawEdge) {
  let drawing = false;
  let previousIndex = null;
  let startIndex = 0;
  while (startIndex < endIndex) {
    const nextIndex = Math.min(endIndex, startIndex + step);
    const afterIndex = nextIndex < path.sampleCount - 1
      ? Math.min(path.sampleCount - 1, nextIndex + step)
      : null;
    const edge = createRouteEdge(
      previousIndex === null ? null : getSample(path.samples, previousIndex),
      getSample(path.samples, startIndex),
      getSample(path.samples, nextIndex),
      afterIndex === null ? null : getSample(path.samples, afterIndex),
      nextIndex === startIndex + 1 ? getRouteEdgeOptions(path.route, startIndex) : {},
    );
    drawing = drawEdge(edge) || drawing;
    previousIndex = startIndex;
    startIndex = nextIndex;
  }
  return drawing;
}

function drawFlatMarker(ctx, map, segment, snapshot) {
  const point = map.latLonToContainerPoint(snapshot.lat, snapshot.lon);
  drawMarker(ctx, point, segment);
}

function drawGlobeMarker(ctx, map, geometry, segment, snapshot) {
  const point = map.latLonToGlobePoint(snapshot.lat, snapshot.lon, geometry);
  if (point.visible) drawMarker(ctx, point, segment);
}

function drawMarker(ctx, point, segment) {
  const radius = Math.max(4, Number(segment.width) + 2);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = segment.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.stroke();
  ctx.restore();
}

function setupRouteContext(ctx, segment, alpha) {
  ctx.lineWidth = Math.max(1, Number(segment.width) || 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = segment.color || "#2563eb";
  ctx.globalAlpha = alpha;
}

function getSegmentPath(segment, pathMode) {
  if (pathMode === "tracking-only") {
    return {
      samples: segment.sourceSamples,
      sampleCount: segment.sourceSampleCount,
      route: segment.sourceRoute,
    };
  }
  return { samples: segment.samples, sampleCount: segment.sampleCount, route: segment.sampleRoute };
}

function getRevealedPath(segment, snapshot, pathMode) {
  const path = getSegmentPath(segment, pathMode);
  if (pathMode !== "tracking-only") {
    return { ...path, endIndex: snapshot.sampleIndex, edgeRatio: snapshot.sampleRatio };
  }
  const timed = samplePathAtDistance(
    path.samples,
    path.sampleCount,
    snapshot.localDistanceM,
    path.route,
  );
  return {
    ...path,
    endIndex: timed.startIndex,
    edgeRatio: timed.ratio,
  };
}

function getPackedRouteEdge(path, edgeIndex) {
  return createRouteEdge(
    edgeIndex > 0 ? getSample(path.samples, edgeIndex - 1) : null,
    getSample(path.samples, edgeIndex),
    getSample(path.samples, edgeIndex + 1),
    edgeIndex + 2 < path.sampleCount ? getSample(path.samples, edgeIndex + 2) : null,
    getRouteEdgeOptions(path.route, edgeIndex),
  );
}

function getRouteEdgeOptions(route, edgeIndex) {
  if (!route?.edgeKinds || !route?.edgeAngles) return {};
  return {
    kind: route.edgeKinds[edgeIndex],
    angleDegrees: route.edgeAngles[edgeIndex],
  };
}

function getSample(samples, index) {
  const offset = index * SAMPLE_STRIDE;
  return {
    index,
    lat: samples[offset],
    lon: samples[offset + 1],
  };
}

function getDrawStep(sampleCount) {
  return Math.max(1, Math.ceil(sampleCount / MAX_DRAWN_SAMPLES_PER_PASS));
}

export { PlaybackCanvasLayer };
