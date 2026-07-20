const DEFAULT_TIME_GRADIENT_STEPS = 64;

function createColorRamp(startColor, endColor, steps = DEFAULT_TIME_GRADIENT_STEPS) {
  const count = Math.max(2, Math.round(Number(steps) || DEFAULT_TIME_GRADIENT_STEPS));
  const start = parseHexColor(startColor, "#2563eb");
  const end = parseHexColor(endColor, startColor || "#2563eb");
  const colors = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1);
    colors[index] = formatHexColor({
      red: interpolateChannel(start.red, end.red, ratio),
      green: interpolateChannel(start.green, end.green, ratio),
      blue: interpolateChannel(start.blue, end.blue, ratio),
    });
  }

  return colors;
}

function getTimeGradientBin(timeMs, startMs, endMs, steps = DEFAULT_TIME_GRADIENT_STEPS) {
  const count = Math.max(2, Math.round(Number(steps) || DEFAULT_TIME_GRADIENT_STEPS));
  return Math.round(getTimeGradientRatio(timeMs, startMs, endMs) * (count - 1));
}

function getTimeGradientColor(ramp, timeMs, startMs, endMs) {
  if (!Array.isArray(ramp) || ramp.length === 0) return "#2563eb";
  return ramp[getTimeGradientBin(timeMs, startMs, endMs, ramp.length)] ?? ramp[0];
}

function getTimeGradientRatio(timeMs, startMs, endMs) {
  const start = Number(startMs);
  const end = Number(endMs);
  const time = Number(timeMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(time)) {
    return 0;
  }
  return clamp((time - start) / (end - start), 0, 1);
}

function visitTimeGradientBands(
  edgeStartMs,
  edgeEndMs,
  rangeStartMs,
  rangeEndMs,
  visitor,
  steps = DEFAULT_TIME_GRADIENT_STEPS,
) {
  if (typeof visitor !== "function") return;
  const count = Math.max(2, Math.round(Number(steps) || DEFAULT_TIME_GRADIENT_STEPS));
  const startRatio = getTimeGradientRatio(edgeStartMs, rangeStartMs, rangeEndMs);
  const endRatio = getTimeGradientRatio(edgeEndMs, rangeStartMs, rangeEndMs);

  if (endRatio <= startRatio) {
    visitor(0, 1, Math.round(startRatio * (count - 1)));
    return;
  }

  const maximumIndex = count - 1;
  let bandIndex = Math.round(startRatio * maximumIndex);
  let edgeRatioStart = 0;

  while (bandIndex < maximumIndex) {
    const nextBoundary = (bandIndex + 0.5) / maximumIndex;
    if (nextBoundary >= endRatio) break;
    if (nextBoundary > startRatio) {
      const edgeRatioEnd = (nextBoundary - startRatio) / (endRatio - startRatio);
      visitor(edgeRatioStart, edgeRatioEnd, bandIndex);
      edgeRatioStart = edgeRatioEnd;
    }
    bandIndex += 1;
  }

  visitor(edgeRatioStart, 1, Math.min(maximumIndex, bandIndex));
}

function resolvePointTimeBounds(points) {
  let startMs = Infinity;
  let endMs = -Infinity;
  for (const point of points ?? []) {
    const timeMs = Number(point?.[2]);
    if (!Number.isFinite(timeMs)) continue;
    startMs = Math.min(startMs, timeMs);
    endMs = Math.max(endMs, timeMs);
  }
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? { startMs, endMs }
    : { startMs: 0, endMs: 0 };
}

function parseHexColor(value, fallback) {
  const normalized = normalizeHexColor(value) ?? normalizeHexColor(fallback) ?? "#2563eb";
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function normalizeHexColor(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  return null;
}

function interpolateChannel(start, end, ratio) {
  return Math.round(start + (end - start) * ratio);
}

function formatHexColor({ red, green, blue }) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export {
  DEFAULT_TIME_GRADIENT_STEPS,
  createColorRamp,
  getTimeGradientBin,
  getTimeGradientColor,
  getTimeGradientRatio,
  resolvePointTimeBounds,
  visitTimeGradientBands,
};
