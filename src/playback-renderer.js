import { SAMPLE_STRIDE, samplePathAtDistance } from "./playback-model.js";
import { createRouteEdge, getRouteEdgeRange, interpolateRouteEdge } from "./route-geometry.js";
import { drawRouteEdgeFlat, drawRouteEdgeGlobe } from "./route-canvas.js";
import {
  createColorRamp,
  getTimeGradientColor,
  visitTimeGradientBands,
} from "./time-gradient.js";

const MAX_DRAWN_SAMPLES_PER_PASS = 50_000;
const MARKER_TANGENT_SAMPLE_RATIO = 0.01;
const DEFAULT_NODE_SIZE_PX = 8;

class PlaybackCanvasLayer {
  constructor(sequence, options = {}) {
    this.sequence = sequence;
    this.previewAlpha = 0.3;
    this.previewColor = null;
    this.pathMode = options.pathMode === "tracking-only" ? "tracking-only" : "resampled";
    this.nodeMode = options.nodeMode === "arrow" ? "arrow" : "circle";
    this.nodeSize = normalizeNodeSize(options.nodeSize);
    this.snapshot = null;
    this.pointCount = sequence?.sampleCount ?? 0;
    this.colorRamps = (sequence?.segments ?? []).map((segment) =>
      segment.colorMode === "gradient"
        ? createColorRamp(segment.gradientStartColor, segment.gradientEndColor)
        : null,
    );
    if (options.previewColor) {
      this.setCustomPreview(options.previewColor, options.previewAlpha ?? 0.3);
    } else {
      this.setPreviewAlpha(options.previewAlpha ?? 0.3);
    }
  }

  setSnapshot(snapshot) {
    this.snapshot = snapshot;
  }

  setPreviewAlpha(alpha) {
    const value = Number(alpha);
    this.previewColor = null;
    this.previewAlpha = value >= 0.9 ? 0.9 : value > 0 ? 0.3 : 0;
  }

  setCustomPreview(color, alpha) {
    const value = Number(alpha);
    this.previewColor = String(color || "#2563eb");
    this.previewAlpha = Number.isFinite(value)
      ? Math.max(0, Math.min(1, value))
      : 0.3;
  }

  setPathMode(pathMode) {
    this.pathMode = pathMode === "tracking-only" ? "tracking-only" : "resampled";
  }

  setNodeMode(nodeMode) {
    this.nodeMode = nodeMode === "arrow" ? "arrow" : "circle";
  }

  setNodeSize(nodeSize) {
    this.nodeSize = normalizeNodeSize(nodeSize);
  }

  draw(ctx, map) {
    if (!this.snapshot || !this.sequence?.segments?.length) return;
    if (this.previewAlpha > 0) {
      for (let index = 0; index < this.sequence.segments.length; index += 1) {
        const segment = this.sequence.segments[index];
        const path = getSegmentPath(segment, this.pathMode);
        drawFlatSegment(
          ctx,
          map,
          segment,
          path,
          path.sampleCount - 1,
          this.previewAlpha,
          0,
          this.previewColor ? null : this.colorRamps[index],
          this.previewColor,
        );
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
    drawFlatMarker(
      ctx,
      map,
      active,
      this.snapshot,
      activeRamp,
      this.nodeMode,
      this.nodeSize,
      revealed,
    );
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
          this.previewColor ? null : this.colorRamps[index],
          this.previewColor,
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
    drawGlobeMarker(
      ctx,
      map,
      geometry,
      active,
      this.snapshot,
      activeRamp,
      this.nodeMode,
      this.nodeSize,
      revealed,
    );
    ctx.globalAlpha = 1;
  }
}

function drawFlatSegment(
  ctx,
  map,
  segment,
  path,
  endIndex,
  alpha,
  edgeRatio = 0,
  colorRamp = null,
  colorOverride = null,
) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha, colorOverride);
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
  colorOverride = null,
) {
  if (endIndex < 1 && edgeRatio <= 0) return;
  setupRouteContext(ctx, segment, alpha, colorOverride);
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

function drawFlatMarker(ctx, map, segment, snapshot, colorRamp, nodeMode, nodeSize, path) {
  const point = map.latLonToContainerPoint(snapshot.lat, snapshot.lon);
  const heading = nodeMode === "arrow"
    ? getMarkerHeading(path, (candidate) => map.latLonToContainerPoint(candidate.lat, candidate.lon))
    : 0;
  drawMarker(ctx, point, segment, snapshot, colorRamp, nodeMode, nodeSize, heading);
}

function drawGlobeMarker(ctx, map, geometry, segment, snapshot, colorRamp, nodeMode, nodeSize, path) {
  const point = map.latLonToGlobePoint(snapshot.lat, snapshot.lon, geometry);
  if (!point.visible) return;
  const heading = nodeMode === "arrow"
    ? getMarkerHeading(
      path,
      (candidate) => map.latLonToGlobePoint(candidate.lat, candidate.lon, geometry),
    )
    : 0;
  drawMarker(ctx, point, segment, snapshot, colorRamp, nodeMode, nodeSize, heading);
}

function drawMarker(ctx, point, segment, snapshot, colorRamp, nodeMode, nodeSize, heading) {
  const radius = nodeSize / 2;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colorRamp
    ? getTimeGradientColor(colorRamp, snapshot.localElapsedMs, 0, segment.durationMs)
    : segment.color;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  if (nodeMode === "arrow") drawSendArrow(ctx, point, radius, heading);
  else {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSendArrow(ctx, point, radius, heading) {
  const scale = radius / 7;
  ctx.translate(point.x, point.y);
  ctx.rotate(heading);
  ctx.scale(scale, scale);
  ctx.translate(-8, -8);
  ctx.beginPath();
  // Filled outer silhouette from VS Code Codicon's 16px `send` icon.
  ctx.moveTo(1.17683, 1.11898);
  ctx.bezierCurveTo(1.32953, 0.989634, 1.54464, 0.963786, 1.72363, 1.05328);
  ctx.lineTo(14.7236, 7.55328);
  ctx.bezierCurveTo(14.893, 7.63797, 15, 7.8111, 15, 8.00049);
  ctx.bezierCurveTo(15, 8.18987, 14.893, 8.36301, 14.7236, 8.4477);
  ctx.lineTo(1.72363, 14.9477);
  ctx.bezierCurveTo(1.54464, 15.0372, 1.32953, 15.0113, 1.17683, 14.882);
  ctx.bezierCurveTo(1.02414, 14.7526, 0.96328, 14.5447, 1.02213, 14.3534);
  ctx.lineTo(2.97688, 8.00049);
  ctx.lineTo(1.02213, 1.64754);
  ctx.bezierCurveTo(0.96328, 1.45627, 1.02414, 1.24833, 1.17683, 1.11898);
  ctx.closePath();
  ctx.lineWidth = 2 / scale;
  ctx.lineJoin = "round";
  ctx.fill();
  ctx.stroke();
}

function getMarkerHeading(path, projectPoint) {
  const edgeCount = Math.max(0, Number(path?.sampleCount) - 1);
  if (!edgeCount) return 0;
  let edgeIndex = Math.max(0, Math.min(edgeCount - 1, Number(path.endIndex) || 0));
  let ratio = Math.max(0, Math.min(1, Number(path.edgeRatio) || 0));
  if (Number(path.endIndex) >= edgeCount) {
    edgeIndex = edgeCount - 1;
    ratio = 1;
  }

  const localHeading = getEdgeHeading(
    path,
    edgeIndex,
    Math.max(0, ratio - MARKER_TANGENT_SAMPLE_RATIO),
    Math.min(1, ratio + MARKER_TANGENT_SAMPLE_RATIO),
    projectPoint,
  );
  if (localHeading !== null) return localHeading;

  for (let offset = 1; offset < edgeCount; offset += 1) {
    const previousIndex = edgeIndex - offset;
    if (previousIndex >= 0) {
      const previousHeading = getEdgeHeading(path, previousIndex, 0, 1, projectPoint);
      if (previousHeading !== null) return previousHeading;
    }
    const nextIndex = edgeIndex + offset;
    if (nextIndex < edgeCount) {
      const nextHeading = getEdgeHeading(path, nextIndex, 0, 1, projectPoint);
      if (nextHeading !== null) return nextHeading;
    }
  }
  return 0;
}

function getEdgeHeading(path, edgeIndex, startRatio, endRatio, projectPoint) {
  if (endRatio <= startRatio) {
    if (startRatio >= 1) startRatio = Math.max(0, 1 - MARKER_TANGENT_SAMPLE_RATIO);
    else endRatio = Math.min(1, startRatio + MARKER_TANGENT_SAMPLE_RATIO);
  }
  const edge = getPackedRouteEdge(path, edgeIndex);
  const start = projectPoint(interpolateRouteEdge(edge, startRatio));
  const end = projectPoint(interpolateRouteEdge(edge, endRatio));
  const deltaX = Number(end?.x) - Number(start?.x);
  const deltaY = Number(end?.y) - Number(start?.y);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.hypot(deltaX, deltaY) < 1e-6) {
    return null;
  }
  return Math.atan2(deltaY, deltaX);
}

function normalizeNodeSize(nodeSize) {
  const size = Number(nodeSize);
  return Number.isFinite(size)
    ? Math.max(4, Math.min(64, size))
    : DEFAULT_NODE_SIZE_PX;
}

function setupRouteContext(ctx, segment, alpha, colorOverride = null) {
  ctx.lineWidth = Math.max(1, Number(segment.width) || 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = colorOverride || segment.color || "#2563eb";
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
