import { SAMPLE_STRIDE, samplePathAtDistance } from "./playback-model.js";

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
        drawFlatSegment(ctx, map, segment, path.samples, path.sampleCount - 1, this.previewAlpha);
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawFlatSegment(ctx, map, segment, path.samples, path.sampleCount - 1, 0.9);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    drawFlatSegment(ctx, map, active, revealed.samples, revealed.endIndex, 0.9, revealed.head);
    drawFlatMarker(ctx, map, active, this.snapshot);
    ctx.globalAlpha = 1;
  }

  drawGlobe(ctx, map, geometry) {
    if (!this.snapshot || !this.sequence?.segments?.length) return;
    if (this.previewAlpha > 0) {
      for (const segment of this.sequence.segments) {
        const path = getSegmentPath(segment, this.pathMode);
        drawGlobeSegment(ctx, map, geometry, segment, path.samples, path.sampleCount - 1, this.previewAlpha);
      }
    }

    for (let index = 0; index < this.snapshot.segmentIndex; index += 1) {
      const segment = this.sequence.segments[index];
      const path = getSegmentPath(segment, this.pathMode);
      drawGlobeSegment(ctx, map, geometry, segment, path.samples, path.sampleCount - 1, 0.9);
    }

    const active = this.sequence.segments[this.snapshot.segmentIndex];
    const revealed = getRevealedPath(active, this.snapshot, this.pathMode);
    drawGlobeSegment(ctx, map, geometry, active, revealed.samples, revealed.endIndex, 0.9, revealed.head);
    drawGlobeMarker(ctx, map, geometry, active, this.snapshot);
    ctx.globalAlpha = 1;
  }
}

function drawFlatSegment(ctx, map, segment, samples, endIndex, alpha, head = null) {
  if (endIndex < 1 && !head?.sampleRatio) return;
  setupRouteContext(ctx, segment, alpha);
  const step = getDrawStep(endIndex + 1);
  let previous = getSample(samples, 0);
  let drawing = false;
  ctx.beginPath();

  for (let index = step; index <= endIndex; index += step) {
    const current = getSample(samples, Math.min(index, endIndex));
    drawing = addFlatEdge(ctx, map, previous, current) || drawing;
    previous = current;
  }

  if (endIndex > 0 && (endIndex % step !== 0 || previous.index !== endIndex)) {
    const current = getSample(samples, endIndex);
    drawing = addFlatEdge(ctx, map, previous, current) || drawing;
    previous = current;
  }

  if (head?.sampleRatio > 0) {
    drawing = addFlatEdge(ctx, map, previous, head) || drawing;
  }
  if (drawing) ctx.stroke();
}

function drawGlobeSegment(ctx, map, geometry, segment, samples, endIndex, alpha, head = null) {
  if (endIndex < 1 && !head?.sampleRatio) return;
  setupRouteContext(ctx, segment, alpha);
  const step = getDrawStep(endIndex + 1);
  let previous = projectGlobe(map, geometry, getSample(samples, 0));
  let drawing = false;
  ctx.beginPath();

  for (let index = step; index <= endIndex; index += step) {
    const current = projectGlobe(map, geometry, getSample(samples, Math.min(index, endIndex)));
    if (previous.visible && current.visible) {
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      drawing = true;
    }
    previous = current;
  }

  if (endIndex > 0 && endIndex % step !== 0) {
    const current = projectGlobe(map, geometry, getSample(samples, endIndex));
    if (previous.visible && current.visible) {
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      drawing = true;
    }
    previous = current;
  }

  if (head?.sampleRatio > 0) {
    const current = projectGlobe(map, geometry, head);
    if (previous.visible && current.visible) {
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      drawing = true;
    }
  }
  if (drawing) ctx.stroke();
}

function addFlatEdge(ctx, map, start, end) {
  const segment = map.segmentIntersectsView([start.lat, start.lon], [end.lat, end.lon], 24);
  if (!segment.visible) return false;
  ctx.moveTo(segment.start.x, segment.start.y);
  ctx.lineTo(segment.end.x, segment.end.y);
  return true;
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

function projectGlobe(map, geometry, point) {
  return map.latLonToGlobePoint(point.lat, point.lon, geometry);
}

function getSegmentPath(segment, pathMode) {
  if (pathMode === "tracking-only") {
    return { samples: segment.sourceSamples, sampleCount: segment.sourceSampleCount };
  }
  return { samples: segment.samples, sampleCount: segment.sampleCount };
}

function getRevealedPath(segment, snapshot, pathMode) {
  const path = getSegmentPath(segment, pathMode);
  if (pathMode !== "tracking-only") {
    return { ...path, endIndex: snapshot.sampleIndex, head: snapshot };
  }
  const timed = samplePathAtDistance(path.samples, path.sampleCount, snapshot.localDistanceM);
  return {
    ...path,
    endIndex: timed.startIndex,
    head: timed.ratio > 0 ? { ...timed, sampleRatio: timed.ratio } : null,
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
