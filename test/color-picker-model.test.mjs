import test from "node:test";
import assert from "node:assert/strict";
import { hexToHsv, hexToRgb, hsvToHex, rgbToHex } from "../src/color-picker-model.js";

test("round-trips solid picker colors through HSV", () => {
  for (const color of ["#2563eb", "#ffffff", "#000000", "#eb2925", "#25eb6b"]) {
    assert.equal(hsvToHex(hexToHsv(color)), color);
  }
});

test("maps the saturation and brightness corners to expected colors", () => {
  assert.equal(hsvToHex({ hue: 0, saturation: 1, value: 1 }), "#ff0000");
  assert.equal(hsvToHex({ hue: 120, saturation: 1, value: 1 }), "#00ff00");
  assert.equal(hsvToHex({ hue: 240, saturation: 1, value: 1 }), "#0000ff");
  assert.equal(hsvToHex({ hue: 90, saturation: 0, value: 1 }), "#ffffff");
  assert.equal(hsvToHex({ hue: 90, saturation: 1, value: 0 }), "#000000");
});

test("converts RGB entry values to hex and clamps each channel", () => {
  assert.deepEqual(hexToRgb("#2563eb"), { red: 37, green: 99, blue: 235 });
  assert.equal(rgbToHex({ red: 37, green: 99, blue: 235 }), "#2563eb");
  assert.equal(rgbToHex({ red: -1, green: 300, blue: 127.6 }), "#00ff80");
});
