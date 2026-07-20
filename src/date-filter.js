function getDateFilterReason(timeMs, options = {}) {
  const time = Number(timeMs);
  if (!Number.isFinite(time)) return "range";

  const rangeStartMs = options.dateRangeStartMs;
  const rangeEndMs = options.dateRangeEndMs;
  if (Number.isFinite(rangeStartMs) && time < rangeStartMs) return "range";
  if (Number.isFinite(rangeEndMs) && time > rangeEndMs) return "range";

  for (const interval of options.dateExclusions ?? []) {
    const startMs = interval?.startMs;
    const endMs = interval?.endMs;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) continue;
    if (time >= startMs && time <= endMs) return "exclusion";
  }

  return "";
}

function filterPointsByDate(points, options = {}) {
  const source = points ?? [];
  let filtered = null;
  for (let index = 0; index < source.length; index += 1) {
    const point = source[index];
    if (getDateFilterReason(point?.[2], options)) {
      if (!filtered) filtered = source.slice(0, index);
    } else if (filtered) {
      filtered.push(point);
    }
  }
  return filtered ?? source;
}

function isValidDateInterval(startMs, endMs, minimumMs, maximumMs) {
  const values = [startMs, endMs, minimumMs, maximumMs];
  if (!values.every(Number.isFinite)) return false;
  const [start, end, minimum, maximum] = values;
  return minimum <= maximum && start >= minimum && end <= maximum && start <= end;
}

function formatDateTimeLocal(timeMs) {
  const date = new Date(Number(timeMs));
  if (!Number.isFinite(date.getTime())) return "";

  const datePart = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
  const timePart = [date.getHours(), date.getMinutes()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  return `${datePart}T${timePart}`;
}

function parseDateTimeLocal(value) {
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  return new Date(text).getTime();
}

function floorDateTimeToMinute(timeMs) {
  const date = new Date(Number(timeMs));
  if (!Number.isFinite(date.getTime())) return NaN;
  date.setSeconds(0, 0);
  return date.getTime();
}

function ceilDateTimeToMinute(timeMs) {
  const value = Number(timeMs);
  const floor = floorDateTimeToMinute(value);
  if (!Number.isFinite(floor)) return NaN;
  return value > floor ? floor + 60_000 : floor;
}

function resolveDateBounds(stats, points = []) {
  const statsStartMs = stats?.minTimeMs;
  const statsEndMs = stats?.maxTimeMs;
  if (Number.isFinite(statsStartMs) && Number.isFinite(statsEndMs) && statsStartMs <= statsEndMs) {
    return { startMs: statsStartMs, endMs: statsEndMs, source: "raw" };
  }

  let startMs = Infinity;
  let endMs = -Infinity;
  for (const point of points ?? []) {
    const timeMs = point?.[2];
    if (!Number.isFinite(timeMs)) continue;
    startMs = Math.min(startMs, timeMs);
    endMs = Math.max(endMs, timeMs);
  }
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? { startMs, endMs, source: "cleaned" }
    : null;
}

export {
  ceilDateTimeToMinute,
  filterPointsByDate,
  floorDateTimeToMinute,
  formatDateTimeLocal,
  getDateFilterReason,
  isValidDateInterval,
  parseDateTimeLocal,
  resolveDateBounds,
};
