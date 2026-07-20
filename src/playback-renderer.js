import { SAMPLE_STRIDE, samplePathAtDistance } from "./playback-model.js";
import { createRouteEdge, getRouteEdgeRange } from "./route-geometry.js";
import { drawRouteEdgeFlat, drawRouteEdgeGlobe } from "./route-canvas.js";
import {
  createColorRamp,
  getTimeGradientColor,
  visitTimeGradientBands,
} from "./time-gradient.js";

const MAX_DRAWN_SAMPLES_PER_PASS = 50_000;

class PlaybackCanvasLayer {
  constructor(sequence, options = {}) {
    this.sequence = sequence;
    this.previewAlpha = options.previewAlpha ?? 0.3;
    this.pathMode = options.pathMode === "tracking-only" ? "tracking-only" : "resampled";
    this.snapshot = null;
    this.pointCount = sequence?.sampleCount ?? 0;
    this.colorRamps = (sequence?.segments ?? []).map((segment) =>
      segment.colorMode === "gradient"
        ? createColorRamp(segment.gradientStartColor, segment.gradientEndColor)
        : null,
    );
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
      for (let index = 0; index < this.sequence.segments.length; index += 1) {
        const segment = this.sequence.segments[index];
        const path = getSegmentPath(segment, this.pathMode);
        drawFlatSegment(ctx, map, segment, path, path.sampleCount - 1, this.previewAlpha, 0, this.colorRamps[index]);
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawFlatSegment(ctx, map, segment, path, path.sampleCount - 1, 0.9, 0, this.colorRamps[index]);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    const activeRamp = this.colorRamps[this.snapshot.segmentIndex];
    drawFlatSegment(ctx, map, active, revealed, revealed.endIndex, 0.9, revealed.edgeRatio, activeRamp);
    drawFlatMarker(ctx, map, active, this.snapshot, activeRamp);
    ctx.globalAlpha = 1;
  }

  drawGlobe(ctx, map, geometry) {
    if (!this.snapshot || !this.sequence?.segments?.length) return;
    if (this.previewAlpha > 0) {
      for (let index = 0; index < this.sequence.segments.length; index += 1) {
        const segment = this.sequence.segments[index];
        const path = getSegmentPath(segment, this.pathMode);
        drawGlobeSegment(
          ctx,
          map,
          geometry,
          segment,
          path,
          path.sampleCount - 1,
          this.previewAlpha,
          0,
          this.colorRamps[index],
        );
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawGlobeSegment(ctx, map, geometry, segment, path, path.sampleCount - 1, 0.9, 0, this.colorRamps[index]);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    const activeRamp = this.colorRamps[this.snapshot.segmentIndex];
    drawGlobeSegment(
      ctx,
      map,
      geometry,
      active,
      revealed,
      revealed.endIndex,
      0.9,
      revealed.edgeRatio,
      activeRamp,
    );
    drawGlobeMarker(ctx, map, geometry, active, this.snapshot, activeRamp);
    ctx.globalAlpha = 1;
  }
}

function drawFlatSegment(ctx, map, segment, path, endIndex, alpha, edgeRatio = 0, colorRamp = null) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha);
  if (colorRamp) {
    drawGradientSegment(
      ctx,
      segment,
      path,
      endIndex,
      edgeRatio,
      colorRamp,
      (edge) => drawRouteEdgeFlat(ctx, map, edge, 1, 24),
    );
    return;
  }
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

function drawGlobeSegment(
  ctx,
  map,
  geometry,
  segment,
  path,
  endIndex,
  alpha,
  edgeRatio = 0,
  colorRamp = null,
) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha);
  if (colorRamp) {
    drawGradientSegment(
      ctx,
      segment,
      path,
      endIndex,
      edgeRatio,
      colorRamp,
      (edge) => drawRouteEdgeGlobe(ctx, map, geometry, edge, 1, Number(segment.width) + 4),
    );
    return;
  }
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

function drawGradientSegment(ctx, segment, path, endIndex, edgeRatio, colorRamp, drawEdge) {
  const step = getDrawStep(endIndex + 1);
  let activeBin = -1;
  let drawing = false;

  const selectBand = (bin) => {
    if (bin === activeBin) return;
    if (drawing) ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = colorRamp[bin];
    activeBin = bin;
    drawing = false;
  };

  const drawTimedEdge = (edge, startTimeMs, endTimeMs, startRatio = 0, endRatio = 1) => {
    const visibleStartTime = interpolate(startTimeMs, endTimeMs, startRatio);
    const visibleEndTime = interpolate(startTimeMs, endTimeMs, endRatio);
    visitTimeGradientBands(
      visibleStartTime,
      visibleEndTime,
      0,
      segment.durationMs,
      (bandStartRatio, bandEndRatio, bin) => {
        selectBand(bin);
        const routeStartRatio = interpolate(startRatio, endRatio, bandStartRatio);
        const routeEndRatio = interpolate(startRatio, endRatio, bandEndRatio);
        drawing = drawEdge(getRouteEdgeRange(edge, routeStartRatio, routeEndRatio)) || drawing;
      },
      colorRamp.length,
    );
  };

  let previousIndex = null;
  let startIndex = 0;
  while (startIndex < endIndex) {
    const nextIndex = Math.min(endIndex, startIndex + step);
    const afterIndex = nextIndex < path.sampleCount - 1
      ? Math.min(path.sampleCount - 1, nextIndex + step)
      : null;
    const start = getSample(path.samples, startIndex);
    const end = getSample(path.samples, nextIndex);
    const edge = createRouteEdge(
      previousIndex === null ? null : getSample(path.samples, previousIndex),
      start,
      end,
      afterIndex === null ? null : getSample(path.samples, afterIndex),
      nextIndex === startIndex + 1 ? getRouteEdgeOptions(path.route, startIndex) : {},
    );
    drawTimedEdge(edge, start.timeMs, end.timeMs);
    previousIndex = startIndex;
    startIndex = nextIndex;
  }

  if (edgeRatio > 0 && endIndex < path.sampleCount - 1) {
    const start = getSample(path.samples, endIndex);
    const end = getSample(path.samples, endIndex + 1);
    drawTimedEdge(getPackedRouteEdge(path, endIndex), start.timeMs, end.timeMs, 0, edgeRatio);
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

function drawFlatMarker(ctx, map, segment, snapshot, colorRamp) {
  const point = map.latLonToContainerPoint(snapshot.lat, snapshot.lon);
  drawMarker(ctx, point, segment, snapshot, colorRamp);
}

function drawGlobeMarker(ctx, map, geometry, segment, snapshot, colorRamp) {
  const point = map.latLonToGlobePoint(snapshot.lat, snapshot.lon, geometry);
  if (point.visible) drawMarker(ctx, point, segment, snapshot, colorRamp);
}

function drawMarker(ctx, point, segment, snapshot, colorRamp) {
  const radius = Math.max(4, Number(segment.width) + 2);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = colorRamp
    ? getTimeGradientColor(colorRamp, snapshot.localElapsedMs, 0, segment.durationMs)
    : segment.color;
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
    timeMs: samples[offset + 2],
  };
}

function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

function getDrawStep(sampleCount) {
  return Math.max(1, Math.ceil(sampleCount / MAX_DRAWN_SAMPLES_PER_PASS));
}

export { PlaybackCanvasLayer };
