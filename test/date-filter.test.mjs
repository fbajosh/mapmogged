import test from "node:test";
import assert from "node:assert/strict";
import {
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
});

test("validates ordered intervals inside available bounds", () => {
  assert.equal(isValidDateInterval(100, 200, 0, 300), true);
  assert.equal(isValidDateInterval(200, 100, 0, 300), false);
  assert.equal(isValidDateInterval(-1, 200, 0, 300), false);
  assert.equal(isValidDateInterval(100, 301, 0, 300), false);
  assert.equal(isValidDateInterval(null, null, 0, 300), false);
});

test("round trips local datetime input values", () => {
  const timeMs = new Date(2026, 6, 19, 14, 5, 6, 123).getTime();
  assert.equal(parseDateTimeLocal(formatDateTimeLocal(timeMs)), timeMs);
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
