import { SAMPLE_STRIDE, samplePathAtDistance } from "./playback-model.js";
import {
  createRouteEdge,
  getRouteEdgeBoundsPoints,
} from "./route-geometry.js";

const MERCATOR_MAX_LATITUDE = 85.05112878;
const EPSILON = 1e-9;

class RevealedPathBounds {
  constructor() {
    this.reset();
  }

  reset() {
    this.minLat = Infinity;
    this.maxLat = -Infinity;
    this.minLon = Infinity;
    this.maxLon = -Infinity;
    this.processedSamples = [];
    this.lastElapsedMs = null;
    this.pointCount = 0;
  }

  update(sequence, snapshot, options = {}) {
    if (!sequence?.segments?.length || !snapshot) return null;
    if (this.lastElapsedMs !== null && snapshot.sourceElapsedMs < this.lastElapsedMs) this.reset();
    const pathMode = options.pathMode === "tracking-only" ? "tracking-only" : "resampled";

    for (let segmentIndex = 0; segmentIndex < snapshot.segmentIndex; segmentIndex += 1) {
      const segment = sequence.segments[segmentIndex];
      const path = getSegmentPath(segment, pathMode);
      this.addSegmentThrough(path, segmentIndex, path.sampleCount - 1);
    }

    const active = sequence.segments[snapshot.segmentIndex];
    const activePath = getSegmentPath(active, pathMode);
    if (pathMode === "tracking-only") {
      const timed = samplePathAtDistance(
        activePath.samples,
        activePath.sampleCount,
        snapshot.localDistanceM,
        activePath.route,
      );
      this.addSegmentThrough(activePath, snapshot.segmentIndex, timed.startIndex);
      if (timed.ratio > 0) this.addPartialEdge(activePath, timed.startIndex, timed.ratio);
    } else {
      this.addSegmentThrough(activePath, snapshot.segmentIndex, snapshot.sampleIndex);
      if (snapshot.sampleRatio > 0) {
        this.addPartialEdge(activePath, snapshot.sampleIndex, snapshot.sampleRatio);
      }
    }
    this.lastElapsedMs = snapshot.sourceElapsedMs;
    return this.getBounds();
  }

  addSegmentThrough(path, segmentIndex, endIndex) {
    const lastProcessed = this.processedSamples[segmentIndex] ?? -1;
    const normalizedEnd = Math.min(Math.max(-1, endIndex), path.sampleCount - 1);
    if (lastProcessed < 0 && normalizedEnd >= 0) {
      const first = getPackedPoint(path.samples, 0);
      this.addPoint(first.lat, first.lon);
    }
    for (let index = Math.max(1, lastProcessed + 1); index <= normalizedEnd; index += 1) {
      this.addEdge(path, index - 1, 1);
    }
    this.processedSamples[segmentIndex] = Math.max(lastProcessed, normalizedEnd);
  }

  addPartialEdge(path, edgeIndex, ratio) {
    if (edgeIndex < 0 || edgeIndex >= path.sampleCount - 1) return;
    this.addEdge(path, edgeIndex, ratio);
  }

  addEdge(path, edgeIndex, ratio) {
    const edge = getPackedRouteEdge(path, edgeIndex);
    for (const point of getRouteEdgeBoundsPoints(edge, ratio)) {
      this.addPoint(point.lat, point.lon);
    }
  }

  addPoint(lat, lon) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    this.minLat = Math.min(this.minLat, latitude);
    this.maxLat = Math.max(this.maxLat, latitude);
    this.addLongitude(longitude);
    this.pointCount += 1;
  }

  addLongitude(lon) {
    const longitude = wrapLongitude(lon);
    if (!Number.isFinite(this.minLon)) {
      this.minLon = longitude;
      this.maxLon = longitude;
      return;
    }

    const center = (this.minLon + this.maxLon) / 2;
    const nearest = longitude + 360 * Math.round((center - longitude) / 360);
    const candidates = [nearest - 360, nearest, nearest + 360];
    let best = null;
    for (const candidate of candidates) {
      const min = Math.min(this.minLon, candidate);
      const max = Math.max(this.maxLon, candidate);
      const span = max - min;
      const centerDistance = Math.abs(candidate - center);
      if (!best || span < best.span || (span === best.span && centerDistance < best.centerDistance)) {
        best = { min, max, span, centerDistance };
      }
    }
    this.minLon = best.min;
    this.maxLon = best.max;
  }

  getBounds() {
    if (!this.pointCount) return null;
    return {
      minLat: this.minLat,
      maxLat: this.maxLat,
      minLon: this.minLon,
      maxLon: this.maxLon,
      latitudeSpan: this.maxLat - this.minLat,
      longitudeSpan: this.maxLon - this.minLon,
      pointCount: this.pointCount,
    };
  }
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

function getPackedRouteEdge(path, edgeIndex) {
  return createRouteEdge(
    edgeIndex > 0 ? getPackedPoint(path.samples, edgeIndex - 1) : null,
    getPackedPoint(path.samples, edgeIndex),
    getPackedPoint(path.samples, edgeIndex + 1),
    edgeIndex + 2 < path.sampleCount ? getPackedPoint(path.samples, edgeIndex + 2) : null,
    getRouteEdgeOptions(path.route, edgeIndex),
  );
}

function getPackedPoint(samples, index) {
  const offset = index * SAMPLE_STRIDE;
  return { lat: samples[offset], lon: samples[offset + 1] };
}

function getRouteEdgeOptions(route, edgeIndex) {
  if (!route?.edgeKinds || !route?.edgeAngles) return {};
  return {
    kind: route.edgeKinds[edgeIndex],
    angleDegrees: route.edgeAngles[edgeIndex],
  };
}

function getFitCameraTarget(bounds, options) {
  if (!bounds) return null;
  const width = Math.max(1, Number(options.width) || 1);
  const height = Math.max(1, Number(options.height) || 1);
  const minZoom = Number.isFinite(options.minZoom) ? options.minZoom : 0;
  const allowedMaxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : 18;
  const startingZoom = clamp(Number(options.startingZoom), minZoom, allowedMaxZoom);
  const maxMargin = Math.max(0, Math.min(width, height) / 2 - 1);
  const marginPx = clamp(Number(options.marginPx) || 0, 0, maxMargin);

  if (options.viewMode === "globe") {
    return getGlobeFitCameraTarget(bounds, {
      ...options,
      width,
      height,
      minZoom,
      startingZoom,
      marginPx,
    });
  }
  return getFlatFitCameraTarget(bounds, {
    ...options,
    width,
    height,
    minZoom,
    startingZoom,
    marginPx,
  });
}

function getFlatFitCameraTarget(bounds, options) {
  const tileSize = Number(options.tileSize) || 256;
  const availableWidth = Math.max(1, options.width - options.marginPx * 2);
  const availableHeight = Math.max(1, options.height - options.marginPx * 2);
  const longitudeSpan = Math.max(0, bounds.maxLon - bounds.minLon) / 360;
  const northY = mercatorY(bounds.maxLat);
  const southY = mercatorY(bounds.minLat);
  const latitudeSpan = Math.abs(southY - northY);
  const longitudeZoom = longitudeSpan > EPSILON
    ? Math.log2(availableWidth / (tileSize * longitudeSpan))
    : Infinity;
  const latitudeZoom = latitudeSpan > EPSILON
    ? Math.log2(availableHeight / (tileSize * latitudeSpan))
    : Infinity;
  const zoom = clamp(
    Math.min(options.startingZoom, longitudeZoom, latitudeZoom),
    options.minZoom,
    options.startingZoom,
  );
  const centerY = (northY + southY) / 2;

  return {
    lat: inverseMercatorY(centerY),
    lon: wrapLongitude((bounds.minLon + bounds.maxLon) / 2),
    zoom,
  };
}

function getGlobeFitCameraTarget(bounds, options) {
  const centerLat = clamp((bounds.minLat + bounds.maxLat) / 2, -89.5, 89.5);
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const centerLatRad = toRadians(centerLat);
  const centerLonRad = toRadians(centerLon);
  const latitudes = [bounds.minLat, centerLat, bounds.maxLat];
  const longitudes = [bounds.minLon, centerLon, bounds.maxLon];
  let extentX = 0;
  let extentY = 0;

  for (const lat of latitudes) {
    for (const lon of longitudes) {
      const projection = projectOrthographic(lat, lon, centerLatRad, centerLonRad);
      extentX = Math.max(extentX, Math.abs(projection.x));
      extentY = Math.max(extentY, Math.abs(projection.y));
    }
  }

  const availableHalfWidth = Math.max(1, options.width / 2 - options.marginPx);
  const availableHalfHeight = Math.max(1, options.height / 2 - options.marginPx);
  const widthRadius = extentX > EPSILON ? availableHalfWidth / extentX : Infinity;
  const heightRadius = extentY > EPSILON ? availableHalfHeight / extentY : Infinity;
  const targetRadius = Math.min(widthRadius, heightRadius);
  const radiusRatio = Number(options.globeBaseRadiusRatio) || 0.38;
  const baseZoom = Number.isFinite(options.globeBaseZoom) ? options.globeBaseZoom : 4;
  const zoomScale = Number(options.globeZoomScale) || 1.55;
  const baseRadius = Math.max(1, Math.min(options.width, options.height) * radiusRatio);
  const fitZoom = Number.isFinite(targetRadius)
    ? baseZoom + Math.log(targetRadius / baseRadius) / Math.log(zoomScale)
    : options.startingZoom;

  return {
    lat: centerLat,
    lon: wrapLongitude(centerLon),
    zoom: clamp(Math.min(options.startingZoom, fitZoom), options.minZoom, options.startingZoom),
  };
}

function smoothCamera(current, target, deltaMs, smoothingSeconds) {
  if (!current || !target) return target ?? current ?? null;
  const smoothingMs = Math.max(0, Number(smoothingSeconds) || 0) * 1000;
  const elapsedMs = Math.max(0, Number(deltaMs) || 0);
  const alpha = smoothingMs <= 0 ? 1 : 1 - Math.exp(-elapsedMs / smoothingMs);
  return {
    lat: interpolate(current.lat, target.lat, alpha),
    lon: wrapLongitude(current.lon + shortestLongitudeDelta(current.lon, target.lon) * alpha),
    zoom: interpolate(current.zoom, target.zoom, alpha),
  };
}

function getPredictedSourceElapsedMs(sourceElapsedMs, sourceDurationMs, multiplier, smoothingSeconds) {
  const elapsed = Math.max(0, Number(sourceElapsedMs) || 0);
  const duration = Math.max(0, Number(sourceDurationMs) || 0);
  const rate = Math.max(0, Number(multiplier) || 0);
  const smoothingMs = Math.max(0, Number(smoothingSeconds) || 0) * 1000;
  return clamp(elapsed + smoothingMs * rate, 0, duration);
}

function mercatorY(lat) {
  const safeLat = clamp(Number(lat) || 0, -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
  const sinLat = Math.sin(toRadians(safeLat));
  return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
}

function inverseMercatorY(y) {
  const mercator = Math.PI - 2 * Math.PI * y;
  return clamp((180 / Math.PI) * Math.atan(Math.sinh(mercator)), -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
}

function projectOrthographic(lat, lon, centerLatRad, centerLonRad) {
  const phi = toRadians(lat);
  const lambda = toRadians(lon);
  const delta = lambda - centerLonRad;
  return {
    x: Math.cos(phi) * Math.sin(delta),
    y: -(Math.cos(centerLatRad) * Math.sin(phi) - Math.sin(centerLatRad) * Math.cos(phi) * Math.cos(delta)),
  };
}

function shortestLongitudeDelta(start, end) {
  return ((end - start + 540) % 360) - 180;
}

function wrapLongitude(longitude) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export { RevealedPathBounds, getFitCameraTarget, getPredictedSourceElapsedMs, smoothCamera };
