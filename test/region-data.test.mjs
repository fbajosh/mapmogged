import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findRegionAt, normalizeFeatureCollection } from "../src/region-lookup.js";

const fixtures = [
  ["../gadm/gadm41_ESP_2.json", 40.4168, -3.7038, "Madrid", "Spain"],
  ["../gadm/gadm41_FRA_2.json", 48.8566, 2.3522, "Paris", "France"],
  ["../gadm/gadm41_PRT_1.json", 38.7223, -9.1393, "Lisboa", "Portugal"],
];

for (const [relativePath, lat, lon, expectedRegion, country] of fixtures) {
  test(`resolves a known point in ${country}`, async () => {
    const url = new URL(relativePath, import.meta.url);
    const geojson = JSON.parse(await readFile(url, "utf8"));
    const { features, errors } = normalizeFeatureCollection(geojson, relativePath);
    assert.equal(errors.length, 0);
    const region = findRegionAt(features, lat, lon);
    assert.ok(region);
    assert.equal(region.regionName, expectedRegion);
    assert.equal(region.countryName, country);
  });
}
