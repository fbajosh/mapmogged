import { formatDistance, formatElapsed } from "./playback-model.js";

function getLayerTravelSummary(points, speedUnitId) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const distanceM = points.reduce((total, point) => total + Math.max(0, Number(point?.[4]) || 0), 0);
  const startMs = Number(points[0]?.[2]);
  const endMs = Number(points.at(-1)?.[2]);
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, endMs - startMs)
    : 0;
  const distance = formatDistance(distanceM, speedUnitId);
  const duration = formatElapsed(durationMs);
  return {
    distanceM,
    durationMs,
    text: `distance ${distance.text} ${distance.unit} · duration ${duration.text} ${duration.unit}`,
  };
}

export { getLayerTravelSummary };
