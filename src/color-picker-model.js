function hexToHsv(color) {
  const normalized = normalizeHexColor(color) ?? "#2563eb";
  const rgb = hexToRgb(normalized);
  const red = rgb.red / 255;
  const green = rgb.green / 255;
  const blue = rgb.blue / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: (hue + 360) % 360,
    saturation: maximum > 0 ? delta / maximum : 0,
    value: maximum,
  };
}

function hexToRgb(color) {
  const normalized = normalizeHexColor(color) ?? "#2563eb";
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ red, green, blue }) {
  return `#${toByteHex(red)}${toByteHex(green)}${toByteHex(blue)}`;
}

function hsvToHex({ hue, saturation, value }) {
  const normalizedHue = ((Number(hue) % 360) + 360) % 360;
  const normalizedSaturation = clamp(Number(saturation) || 0, 0, 1);
  const normalizedValue = clamp(Number(value) || 0, 0, 1);
  const chroma = normalizedValue * normalizedSaturation;
  const secondary = chroma * (1 - Math.abs((normalizedHue / 60) % 2 - 1));
  const match = normalizedValue - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (normalizedHue < 60) [red, green] = [chroma, secondary];
  else if (normalizedHue < 120) [red, green] = [secondary, chroma];
  else if (normalizedHue < 180) [green, blue] = [chroma, secondary];
  else if (normalizedHue < 240) [green, blue] = [secondary, chroma];
  else if (normalizedHue < 300) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];

  return `#${toHex(red + match)}${toHex(green + match)}${toHex(blue + match)}`;
}

function normalizeHexColor(color) {
  const text = String(color ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  return null;
}

function toHex(value) {
  return Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, "0");
}

function toByteHex(value) {
  return Math.round(clamp(Number(value) || 0, 0, 255)).toString(16).padStart(2, "0");
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export { hexToHsv, hexToRgb, hsvToHex, rgbToHex };
