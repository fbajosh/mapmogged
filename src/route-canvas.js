import {
  ROUTE_EDGE_BEZIER,
  ROUTE_EDGE_GREAT_CIRCLE,
  getGreatCircleStepCount,
  getPartialRouteEdge,
  interpolateRouteEdge,
} from "./route-geometry.js";

function drawRouteEdgeFlat(ctx, map, edge, ratio = 1, pad = 64) {
  const partial = getPartialRouteEdge(edge, ratio);
  if (partial.kind === ROUTE_EDGE_BEZIER && typeof ctx.bezierCurveTo === "function") {
    const start = projectFlat(map, partial.start);
    const control1 = projectFlat(map, partial.control1);
    const control2 = projectFlat(map, partial.control2);
    const end = projectFlat(map, partial.end);
    if (!projectedCurveIntersectsViewport(map, [start, control1, control2, end], pad)) return false;
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
    return true;
  }

  if (partial.kind === ROUTE_EDGE_GREAT_CIRCLE) {
    const steps = getGreatCircleStepCount(partial.angleDegrees);
    let previous = partial.start;
    let drawing = false;
    for (let step = 1; step <= steps; step += 1) {
      const current = interpolateRouteEdge(partial, step / steps);
      drawing = drawFlatLine(ctx, map, previous, current, pad) || drawing;
      previous = current;
    }
    return drawing;
  }

  return drawFlatLine(ctx, map, partial.start, partial.end, pad);
}

function drawRouteEdgeGlobe(ctx, map, geometry, edge, ratio = 1, pad = 8) {
  const partial = getPartialRouteEdge(edge, ratio);
  if (partial.kind === ROUTE_EDGE_BEZIER && typeof ctx.bezierCurveTo === "function") {
    const start = projectGlobe(map, geometry, partial.start);
    const control1 = projectGlobe(map, geometry, partial.control1);
    const control2 = projectGlobe(map, geometry, partial.control2);
    const end = projectGlobe(map, geometry, partial.end);
    const projected = [start, control1, control2, end];
    if (projected.some((point) => !point.visible)) return false;
    if (!projectedCurveIntersectsViewport(map, projected, pad)) return false;
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
    return true;
  }

  const steps = partial.kind === ROUTE_EDGE_GREAT_CIRCLE
    ? getGreatCircleStepCount(partial.angleDegrees)
    : 1;
  let previous = projectGlobe(map, geometry, partial.start);
  let drawing = false;
  for (let step = 1; step <= steps; step += 1) {
    const current = projectGlobe(map, geometry, interpolateRouteEdge(partial, step / steps));
    if (previous.visible && current.visible && projectedLineIntersectsViewport(map, previous, current, pad)) {
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(current.x, current.y);
      drawing = true;
    }
    previous = current;
  }
  return drawing;
}

function drawFlatLine(ctx, map, start, end, pad) {
  const segment = map.segmentIntersectsView([start.lat, start.lon], [end.lat, end.lon], pad);
  if (!segment.visible) return false;
  ctx.moveTo(segment.start.x, segment.start.y);
  ctx.lineTo(segment.end.x, segment.end.y);
  return true;
}

function projectFlat(map, point) {
  return map.latLonToContainerPoint(point.lat, point.lon);
}

function projectGlobe(map, geometry, point) {
  return map.latLonToGlobePoint(point.lat, point.lon, geometry);
}

function projectedCurveIntersectsViewport(map, points, pad) {
  const width = Number(map.container?.clientWidth);
  const height = Number(map.container?.clientHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return true;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(...xs) >= -pad &&
    Math.min(...xs) <= width + pad &&
    Math.max(...ys) >= -pad &&
    Math.min(...ys) <= height + pad;
}

function projectedLineIntersectsViewport(map, start, end, pad) {
  const width = Number(map.container?.clientWidth);
  const height = Number(map.container?.clientHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return true;
  return Math.max(start.x, end.x) >= -pad &&
    Math.min(start.x, end.x) <= width + pad &&
    Math.max(start.y, end.y) >= -pad &&
    Math.min(start.y, end.y) <= height + pad;
}

export { drawRouteEdgeFlat, drawRouteEdgeGlobe };
