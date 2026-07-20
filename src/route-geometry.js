const ROUTE_EDGE_STRAIGHT = 1;
const ROUTE_EDGE_BEZIER = 2;
const ROUTE_EDGE_GREAT_CIRCLE = 3;

const BEZIER_MIN_ANGLE_DEGREES = 0.1;
const GREAT_CIRCLE_MIN_ANGLE_DEGREES = 1;
const GREAT_CIRCLE_STEP_DEGREES = 0.5;
const MAX_GREAT_CIRCLE_STEPS = 360;
const EPSILON = 1e-12;

function angularDistanceDegrees(start, end) {
  const first = readPoint(start);
  const second = readPoint(end);
  const phi1 = toRadians(first.lat);
  const phi2 = toRadians(second.lat);
  const deltaPhi = phi2 - phi1;
  const deltaLambda = toRadians(shortestLongitudeDelta(first.lon, second.lon));
  const haversine =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
  return toDegrees(centralAngle);
}

function classifyRouteEdge(start, end) {
  return classifyRouteAngle(angularDistanceDegrees(start, end));
}

function classifyRouteAngle(angleDegrees) {
  const angle = Math.max(0, Number(angleDegrees) || 0);
  if (angle > GREAT_CIRCLE_MIN_ANGLE_DEGREES) return ROUTE_EDGE_GREAT_CIRCLE;
  if (angle >= BEZIER_MIN_ANGLE_DEGREES) return ROUTE_EDGE_BEZIER;
  return ROUTE_EDGE_STRAIGHT;
}

function createRouteEdge(previous, start, end, next, options = {}) {
  const first = readPoint(start);
  const secondWrapped = readPoint(end);
  const second = {
    lat: secondWrapped.lat,
    lon: first.lon + shortestLongitudeDelta(first.lon, secondWrapped.lon),
  };
  const angleDegrees = Number.isFinite(options.angleDegrees)
    ? Math.max(0, options.angleDegrees)
    : angularDistanceDegrees(first, second);
  const kind = options.kind ?? classifyRouteAngle(angleDegrees);
  const edge = {
    kind,
    angleDegrees,
    start: first,
    end: second,
  };

  if (kind !== ROUTE_EDGE_BEZIER) return edge;

  const before = getBezierNeighbor(previous, first, second, "previous");
  const after = getBezierNeighbor(next, first, second, "next");
  const firstTangent = clampVector(
    (second.lat - before.lat) / 6,
    (second.lon - before.lon) / 6,
    getMaximumControlLength(first, second),
  );
  const secondTangent = clampVector(
    (after.lat - first.lat) / 6,
    (after.lon - first.lon) / 6,
    getMaximumControlLength(first, second),
  );
  edge.control1 = {
    lat: first.lat + firstTangent.lat,
    lon: first.lon + firstTangent.lon,
  };
  edge.control2 = {
    lat: second.lat - secondTangent.lat,
    lon: second.lon - secondTangent.lon,
  };
  return edge;
}

function interpolateRouteEdge(edge, ratio) {
  const amount = clamp(Number(ratio) || 0, 0, 1);
  if (amount <= 0) return wrapPoint(edge.start);
  if (amount >= 1) return wrapPoint(edge.end);

  if (edge.kind === ROUTE_EDGE_GREAT_CIRCLE) {
    return interpolateGreatCircle(edge.start, edge.end, amount);
  }

  if (edge.kind === ROUTE_EDGE_BEZIER) {
    return wrapPoint({
      lat: cubicBezier(
        edge.start.lat,
        edge.control1.lat,
        edge.control2.lat,
        edge.end.lat,
        amount,
      ),
      lon: cubicBezier(
        edge.start.lon,
        edge.control1.lon,
        edge.control2.lon,
        edge.end.lon,
        amount,
      ),
    });
  }

  return wrapPoint({
    lat: interpolate(edge.start.lat, edge.end.lat, amount),
    lon: interpolate(edge.start.lon, edge.end.lon, amount),
  });
}

function getPartialRouteEdge(edge, ratio) {
  const amount = clamp(Number(ratio) || 0, 0, 1);
  if (amount >= 1) return edge;
  if (edge.kind !== ROUTE_EDGE_BEZIER) {
    return {
      ...edge,
      angleDegrees: edge.angleDegrees * amount,
      end: unwrapPointRelativeTo(interpolateRouteEdge(edge, amount), edge.start.lon),
    };
  }

  const firstLevel0 = interpolatePoint(edge.start, edge.control1, amount);
  const firstLevel1 = interpolatePoint(edge.control1, edge.control2, amount);
  const firstLevel2 = interpolatePoint(edge.control2, edge.end, amount);
  const secondLevel0 = interpolatePoint(firstLevel0, firstLevel1, amount);
  const secondLevel1 = interpolatePoint(firstLevel1, firstLevel2, amount);
  const endpoint = interpolatePoint(secondLevel0, secondLevel1, amount);
  return {
    kind: ROUTE_EDGE_BEZIER,
    angleDegrees: edge.angleDegrees * amount,
    start: edge.start,
    control1: firstLevel0,
    control2: secondLevel0,
    end: endpoint,
  };
}

function getRouteEdgeBoundsPoints(edge, ratio = 1) {
  const partial = getPartialRouteEdge(edge, ratio);
  if (partial.kind === ROUTE_EDGE_BEZIER) {
    return [partial.start, partial.control1, partial.control2, partial.end].map(wrapPoint);
  }
  if (partial.kind === ROUTE_EDGE_GREAT_CIRCLE) {
    const steps = getGreatCircleStepCount(partial.angleDegrees);
    const points = [wrapPoint(partial.start)];
    for (let step = 1; step <= steps; step += 1) {
      points.push(interpolateRouteEdge(partial, step / steps));
    }
    return points;
  }
  return [wrapPoint(partial.start), wrapPoint(partial.end)];
}

function getGreatCircleStepCount(angleDegrees) {
  return Math.max(
    1,
    Math.min(MAX_GREAT_CIRCLE_STEPS, Math.ceil(Math.max(0, angleDegrees) / GREAT_CIRCLE_STEP_DEGREES)),
  );
}

function getBezierNeighbor(point, start, end, direction) {
  if (point) {
    const candidate = readPoint(point);
    const neighborStart = direction === "previous" ? candidate : end;
    const neighborEnd = direction === "previous" ? start : candidate;
    const neighborSpan = Math.hypot(
      neighborEnd.lat - neighborStart.lat,
      shortestLongitudeDelta(neighborStart.lon, neighborEnd.lon),
    );
    if (neighborSpan <= GREAT_CIRCLE_MIN_ANGLE_DEGREES * 1.5) {
      if (direction === "previous") {
        return {
          lat: candidate.lat,
          lon: start.lon - shortestLongitudeDelta(candidate.lon, start.lon),
        };
      }
      return {
        lat: candidate.lat,
        lon: end.lon + shortestLongitudeDelta(end.lon, candidate.lon),
      };
    }
  }

  const latDelta = end.lat - start.lat;
  const lonDelta = end.lon - start.lon;
  return direction === "previous"
    ? { lat: start.lat - latDelta, lon: start.lon - lonDelta }
    : { lat: end.lat + latDelta, lon: end.lon + lonDelta };
}

function getMaximumControlLength(start, end) {
  return Math.hypot(end.lat - start.lat, end.lon - start.lon) / 2;
}

function clampVector(lat, lon, maximumLength) {
  const length = Math.hypot(lat, lon);
  if (length <= maximumLength || length <= EPSILON) return { lat, lon };
  const scale = maximumLength / length;
  return { lat: lat * scale, lon: lon * scale };
}

function interpolateGreatCircle(start, end, ratio) {
  const first = toCartesian(start);
  const second = toCartesian(end);
  const dot = clamp(first.x * second.x + first.y * second.y + first.z * second.z, -1, 1);
  const angle = Math.acos(dot);
  const sine = Math.sin(angle);
  let vector;

  if (angle <= EPSILON) {
    vector = first;
  } else if (Math.abs(sine) > 1e-8) {
    const firstScale = Math.sin((1 - ratio) * angle) / sine;
    const secondScale = Math.sin(ratio * angle) / sine;
    vector = normalizeVector({
      x: first.x * firstScale + second.x * secondScale,
      y: first.y * firstScale + second.y * secondScale,
      z: first.z * firstScale + second.z * secondScale,
    });
  } else {
    const tangent = getAntipodalTangent(first);
    vector = normalizeVector({
      x: first.x * Math.cos(Math.PI * ratio) + tangent.x * Math.sin(Math.PI * ratio),
      y: first.y * Math.cos(Math.PI * ratio) + tangent.y * Math.sin(Math.PI * ratio),
      z: first.z * Math.cos(Math.PI * ratio) + tangent.z * Math.sin(Math.PI * ratio),
    });
  }

  return {
    lat: toDegrees(Math.asin(clamp(vector.z, -1, 1))),
    lon: wrapLongitude(toDegrees(Math.atan2(vector.y, vector.x))),
  };
}

function getAntipodalTangent(vector) {
  const reference = Math.abs(vector.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  return normalizeVector({
    x: reference.y * vector.z - reference.z * vector.y,
    y: reference.z * vector.x - reference.x * vector.z,
    z: reference.x * vector.y - reference.y * vector.x,
  });
}

function toCartesian(point) {
  const lat = toRadians(point.lat);
  const lon = toRadians(point.lon);
  const cosLat = Math.cos(lat);
  return {
    x: cosLat * Math.cos(lon),
    y: cosLat * Math.sin(lon),
    z: Math.sin(lat),
  };
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function readPoint(point) {
  const lat = Number(Array.isArray(point) || ArrayBuffer.isView(point) ? point[0] : point?.lat);
  const lon = Number(Array.isArray(point) || ArrayBuffer.isView(point) ? point[1] : point?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError("Route points must contain finite latitude and longitude values.");
  }
  return { lat, lon: wrapLongitude(lon) };
}

function unwrapPointRelativeTo(point, referenceLongitude) {
  return {
    lat: point.lat,
    lon: referenceLongitude + shortestLongitudeDelta(referenceLongitude, point.lon),
  };
}

function wrapPoint(point) {
  return {
    lat: clamp(point.lat, -90, 90),
    lon: wrapLongitude(point.lon),
  };
}

function interpolatePoint(start, end, ratio) {
  return {
    lat: interpolate(start.lat, end.lat, ratio),
    lon: interpolate(start.lon, end.lon, ratio),
  };
}

function cubicBezier(start, control1, control2, end, ratio) {
  const inverse = 1 - ratio;
  return inverse ** 3 * start +
    3 * inverse ** 2 * ratio * control1 +
    3 * inverse * ratio ** 2 * control2 +
    ratio ** 3 * end;
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

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export {
  BEZIER_MIN_ANGLE_DEGREES,
  GREAT_CIRCLE_MIN_ANGLE_DEGREES,
  ROUTE_EDGE_BEZIER,
  ROUTE_EDGE_GREAT_CIRCLE,
  ROUTE_EDGE_STRAIGHT,
  angularDistanceDegrees,
  classifyRouteAngle,
  classifyRouteEdge,
  createRouteEdge,
  getGreatCircleStepCount,
  getPartialRouteEdge,
  getRouteEdgeBoundsPoints,
  interpolateRouteEdge,
};
