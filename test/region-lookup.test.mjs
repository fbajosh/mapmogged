import test from "node:test";
import assert from "node:assert/strict";
import {
  RegionLookupTracker,
  findRegionAt,
  loadRegionFeatures,
  normalizeRegionFeature,
  pointInRegionFeature,
} from "../src/region-lookup.js";

test("loads every manifest file into one generic region set", async () => {
  const responses = new Map([
    ["http://example.test/gadm/manifest.json", { files: ["a.json", "b.json"] }],
    ["http://example.test/gadm/a.json", { type: "FeatureCollection", features: [makeFeature("Polygon", [square(0, 0, 1, 1)])] }],
    ["http://example.test/gadm/b.json", { type: "FeatureCollection", features: [makeFeature("Polygon", [square(2, 2, 3, 3)], { NAME_1: "Second" })] }],
  ]);
  const fetchImpl = async (url) => ({
    ok: responses.has(url),
    status: responses.has(url) ? 200 : 404,
    json: async () => responses.get(url),
  });

  const result = await loadRegionFeatures("http://example.test/gadm/manifest.json", fetchImpl);
  assert.equal(result.features.length, 2);
  assert.equal(findRegionAt(result.features, 2.5, 2.5).regionName, "Second");
});

test("normalizes the most specific GADM level", () => {
  const feature = normalizeRegionFeature(
    makeFeature("MultiPolygon", [[square(0, 0, 2, 2)]], {
      COUNTRY: "Spain",
      NAME_1: "Andalucía",
      NAME_2: "Almería",
      GID_2: "ESP.1.1_1",
    }),
  );
  assert.equal(feature.regionName, "Almería");
  assert.equal(feature.countryName, "Spain");
  assert.equal(feature.id, "ESP.1.1_1");
});

test("supports polygons, holes, multipolygons, and boundary points", () => {
  const polygon = normalizeRegionFeature(
    makeFeature("Polygon", [square(0, 0, 10, 10), square(4, 4, 6, 6)]),
  );
  assert.equal(pointInRegionFeature(polygon, 2, 2), true);
  assert.equal(pointInRegionFeature(polygon, 5, 5), false);
  assert.equal(pointInRegionFeature(polygon, 0, 5), true);

  const multipolygon = normalizeRegionFeature(
    makeFeature("MultiPolygon", [[square(20, 20, 21, 21)], [square(30, 30, 31, 31)]]),
  );
  assert.equal(pointInRegionFeature(multipolygon, 30.5, 30.5), true);
});

test("checks the preferred feature first", () => {
  const first = normalizeRegionFeature(makeFeature("Polygon", [square(0, 0, 5, 5)], { NAME_1: "First" }));
  const second = normalizeRegionFeature(makeFeature("Polygon", [square(0, 0, 5, 5)], { NAME_1: "Second" }));
  assert.equal(findRegionAt([first, second], 2, 2, second), second);
});

test("throttles checks and clears a label on the third consecutive miss", () => {
  const feature = normalizeRegionFeature(makeFeature("Polygon", [square(0, 0, 5, 5)]));
  const tracker = new RegionLookupTracker([feature]);

  assert.equal(tracker.update(2, 2, 0).label, "Test Region, Test Country");
  assert.equal(tracker.update(20, 20, 500).checked, false);
  assert.equal(tracker.update(20, 20, 1000).label, "Test Region, Test Country");
  assert.equal(tracker.update(20, 20, 2000).label, "Test Region, Test Country");
  const thirdMiss = tracker.update(20, 20, 3000);
  assert.equal(thirdMiss.label, "");
  assert.equal(thirdMiss.consecutiveMisses, 3);
  assert.equal(tracker.update(2, 2, 4000).label, "Test Region, Test Country");
  assert.equal(tracker.consecutiveMisses, 0);
});

test("allows the final location to bypass the lookup throttle", () => {
  const first = normalizeRegionFeature(
    makeFeature("Polygon", [square(0, 0, 5, 5)], { NAME_1: "First" }),
  );
  const last = normalizeRegionFeature(
    makeFeature("Polygon", [square(10, 10, 15, 15)], { NAME_1: "Last" }),
  );
  const tracker = new RegionLookupTracker([first, last]);

  assert.equal(tracker.update(2, 2, 0).label, "First, Test Country");
  assert.equal(tracker.update(12, 12, 500).checked, false);
  const finalLookup = tracker.update(12, 12, 500, { force: true });
  assert.equal(finalLookup.checked, true);
  assert.equal(finalLookup.label, "Last, Test Country");
});

function makeFeature(type, coordinates, properties = {}) {
  return {
    type: "Feature",
    properties: {
      COUNTRY: "Test Country",
      NAME_1: "Test Region",
      GID_1: "TST.1_1",
      ...properties,
    },
    geometry: { type, coordinates },
  };
}

function square(minLon, minLat, maxLon, maxLat) {
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat],
  ];
}
