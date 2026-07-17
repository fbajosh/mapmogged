const REGION_LOOKUP_INTERVAL_MS = 1000;
const REGION_MISS_GRACE_COUNT = 3;

async function loadRegionFeatures(manifestUrl = "./gadm/manifest.json", fetchImpl = fetch) {
  const resolvedManifestUrl = resolveUrl(manifestUrl);
  const manifestResponse = await fetchImpl(resolvedManifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Could not load region manifest (${manifestResponse.status}).`);
  }

  const manifest = await manifestResponse.json();
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  if (!files.length) return { features: [], errors: [] };

  const results = await Promise.allSettled(
    files.map(async (file) => {
      const url = new URL(typeof file === "string" ? file : file.path, resolvedManifestUrl).href;
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      const geojson = await response.json();
      return normalizeFeatureCollection(geojson, url);
    }),
  );

  const features = [];
  const errors = [];
  for (const result of results) {
    if (result.status === "fulfilled") features.push(...result.value.features);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  return { features, errors };
}

function normalizeFeatureCollection(collection, source = "") {
  const features = [];
  const errors = [];

  for (const [index, feature] of (collection?.features ?? []).entries()) {
    try {
      const normalized = normalizeRegionFeature(feature, source, index);
      if (normalized) features.push(normalized);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { features, errors };
}

function normalizeRegionFeature(feature, source = "", index = 0) {
  const geometry = feature?.geometry;
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) return null;
  if (!Array.isArray(geometry.coordinates)) return null;

  const properties = feature.properties ?? {};
  const level = getMostSpecificNameLevel(properties);
  const regionName = cleanPropertyValue(
    level === null ? properties.regionName ?? properties.name ?? properties.NAME : properties[`NAME_${level}`],
  );
  const countryName = cleanPropertyValue(properties.COUNTRY ?? properties.countryName ?? properties.country);
  if (!regionName || !countryName) return null;

  const id = cleanPropertyValue(
    (level === null ? null : properties[`GID_${level}`]) ?? feature.id ?? properties.id,
  ) || `${source || "region"}:${index}`;
  const bbox = getGeometryBbox(geometry);
  if (!bbox) return null;

  return { id, countryName, regionName, geometry, bbox, source };
}

function getMostSpecificNameLevel(properties) {
  let selected = null;
  for (const key of Object.keys(properties)) {
    const match = /^NAME_(\d+)$/.exec(key);
    if (!match || !cleanPropertyValue(properties[key])) continue;
    const level = Number(match[1]);
    if (selected === null || level > selected) selected = level;
  }
  return selected;
}

function cleanPropertyValue(value) {
  const text = String(value ?? "").trim();
  return !text || text.toUpperCase() === "NA" ? "" : text;
}

function getGeometryBbox(geometry) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  visitCoordinates(geometry.coordinates, (coordinate) => {
    const lon = Number(coordinate[0]);
    const lat = Number(coordinate[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  });

  return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null;
}

function visitCoordinates(coordinates, visitor) {
  if (!Array.isArray(coordinates)) return;
  if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    visitor(coordinates);
    return;
  }
  for (const child of coordinates) visitCoordinates(child, visitor);
}

function findRegionAt(features, lat, lon, preferredFeature = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (preferredFeature && pointInRegionFeature(preferredFeature, lat, lon)) return preferredFeature;

  for (const feature of features ?? []) {
    if (feature === preferredFeature) continue;
    if (pointInRegionFeature(feature, lat, lon)) return feature;
  }
  return null;
}

function pointInRegionFeature(feature, lat, lon) {
  if (!feature?.bbox || !bboxContains(feature.bbox, lat, lon)) return false;
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") return pointInPolygon(coordinates, lat, lon);
  if (type === "MultiPolygon") {
    return coordinates.some((polygon) => pointInPolygon(polygon, lat, lon));
  }
  return false;
}

function bboxContains([minLon, minLat, maxLon, maxLat], lat, lon) {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function pointInPolygon(rings, lat, lon) {
  if (!rings?.length || !pointInRing(rings[0], lat, lon)) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(rings[index], lat, lon)) return false;
  }
  return true;
}

function pointInRing(ring, lat, lon) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[previous];
    const end = ring[index];
    const x1 = Number(start?.[0]);
    const y1 = Number(start?.[1]);
    const x2 = Number(end?.[0]);
    const y2 = Number(end?.[1]);
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    if (pointOnSegment(lon, lat, x1, y1, x2, y2)) return true;

    const intersects = y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(x, y, x1, y1, x2, y2) {
  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-10) return false;
  return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
}

class RegionLookupTracker {
  constructor(features = [], options = {}) {
    this.features = features;
    this.intervalMs = options.intervalMs ?? REGION_LOOKUP_INTERVAL_MS;
    this.missGraceCount = options.missGraceCount ?? REGION_MISS_GRACE_COUNT;
    this.lastLookupAt = null;
    this.currentFeature = null;
    this.consecutiveMisses = 0;
  }

  setFeatures(features) {
    this.features = features ?? [];
    this.reset();
  }

  update(lat, lon, nowMs, options = {}) {
    const now = Number(nowMs);
    const force = options.force === true;
    if (!force && this.lastLookupAt !== null && now - this.lastLookupAt < this.intervalMs) {
      return this.result(false);
    }
    this.lastLookupAt = now;

    let match = null;
    try {
      match = findRegionAt(this.features, lat, lon, this.currentFeature);
    } catch {
      match = null;
    }

    if (match) {
      this.currentFeature = match;
      this.consecutiveMisses = 0;
    } else {
      this.consecutiveMisses += 1;
      if (this.consecutiveMisses >= this.missGraceCount) this.currentFeature = null;
    }

    return this.result(true);
  }

  reset() {
    this.lastLookupAt = null;
    this.currentFeature = null;
    this.consecutiveMisses = 0;
  }

  result(checked) {
    return {
      checked,
      feature: this.currentFeature,
      label: this.currentFeature ? `${this.currentFeature.regionName}, ${this.currentFeature.countryName}` : "",
      consecutiveMisses: this.consecutiveMisses,
    };
  }
}

function resolveUrl(url) {
  if (typeof window !== "undefined") return new URL(url, window.location.href).href;
  return new URL(url, "http://localhost/").href;
}

export {
  REGION_LOOKUP_INTERVAL_MS,
  REGION_MISS_GRACE_COUNT,
  RegionLookupTracker,
  findRegionAt,
  getGeometryBbox,
  loadRegionFeatures,
  normalizeFeatureCollection,
  normalizeRegionFeature,
  pointInRegionFeature,
};
