import test from "node:test";
import assert from "node:assert/strict";
import {
  ceilDateTimeToMinute,
  filterPointsByDate,
  floorDateTimeToMinute,
  formatDateTimeLocal,
  getDateFilterReason,
  isValidDateInterval,
  parseDateTimeLocal,
  resolveDateBounds,
} from "../src/date-filter.js";

test("keeps range endpoints and excludes blackout endpoints", () => {
  const options = {
    dateRangeStartMs: 100,
    dateRangeEndMs: 900,
    dateExclusions: [{ startMs: 400, endMs: 600 }],
  };

  assert.equal(getDateFilterReason(99, options), "range");
  assert.equal(getDateFilterReason(100, options), "");
  assert.equal(getDateFilterReason(400, options), "exclusion");
  assert.equal(getDateFilterReason(600, options), "exclusion");
  assert.equal(getDateFilterReason(900, options), "");
  assert.equal(getDateFilterReason(901, options), "range");
  assert.equal(getDateFilterReason(500, { dateRangeStartMs: null, dateRangeEndMs: null }), "");
  assert.deepEqual(
    filterPointsByDate(
      [[0, 0, 99], [0, 0, 100], [0, 0, 500], [0, 0, 900], [0, 0, 901]],
      options,
    ).map((point) => point[2]),
    [100, 900],
  );
});

test("validates ordered intervals inside available bounds", () => {
  assert.equal(isValidDateInterval(100, 200, 0, 300), true);
  assert.equal(isValidDateInterval(200, 100, 0, 300), false);
  assert.equal(isValidDateInterval(-1, 200, 0, 300), false);
  assert.equal(isValidDateInterval(100, 301, 0, 300), false);
  assert.equal(isValidDateInterval(null, null, 0, 300), false);
});

test("formats local datetime inputs at minute precision", () => {
  const timeMs = new Date(2026, 6, 19, 14, 5, 6, 123).getTime();
  assert.equal(formatDateTimeLocal(timeMs), "2026-07-19T14:05");
  assert.equal(parseDateTimeLocal(formatDateTimeLocal(timeMs)), new Date(2026, 6, 19, 14, 5).getTime());
});

test("rounds available bounds outward to whole minutes", () => {
  const exactMinute = new Date(2026, 6, 19, 14, 5).getTime();
  assert.equal(floorDateTimeToMinute(exactMinute + 59_999), exactMinute);
  assert.equal(ceilDateTimeToMinute(exactMinute), exactMinute);
  assert.equal(ceilDateTimeToMinute(exactMinute + 1), exactMinute + 60_000);
});

test("prefers raw bounds and falls back to cleaned timestamps", () => {
  assert.deepEqual(resolveDateBounds({ minTimeMs: 100, maxTimeMs: 900 }, [[0, 0, 200], [0, 0, 800]]), {
    startMs: 100,
    endMs: 900,
    source: "raw",
  });
  assert.deepEqual(resolveDateBounds({}, [[0, 0, 200], [0, 0, 800]]), {
    startMs: 200,
    endMs: 800,
    source: "cleaned",
  });
  assert.equal(resolveDateBounds({}, []), null);
});
