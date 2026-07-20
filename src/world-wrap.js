function alignWrappedX(x, referenceX, worldSize) {
  const projectedX = Number(x);
  const reference = Number(referenceX);
  const size = Number(worldSize);
  if (!Number.isFinite(projectedX) || !Number.isFinite(reference) || !Number.isFinite(size) || size <= 0) {
    return projectedX;
  }
  return projectedX + Math.round((reference - projectedX) / size) * size;
}

function getVisibleWorldShifts(points, width, height, worldSize, pad = 0) {
  const viewportWidth = Number(width);
  const viewportHeight = Number(height);
  const size = Number(worldSize);
  const padding = Math.max(0, Number(pad) || 0);
  if (
    !points?.length ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return [];
  }

  const xs = points.map((point) => Number(point?.x));
  const ys = points.map((point) => Number(point?.y));
  if ([...xs, ...ys].some((value) => !Number.isFinite(value))) return [];
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (maxY < -padding || minY > viewportHeight + padding) return [];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const firstCopy = Math.ceil((-padding - maxX) / size);
  const lastCopy = Math.floor((viewportWidth + padding - minX) / size);
  const shifts = [];
  for (let copy = firstCopy; copy <= lastCopy; copy += 1) {
    shifts.push(copy * size);
  }
  return shifts;
}

export { alignWrappedX, getVisibleWorldShifts };
