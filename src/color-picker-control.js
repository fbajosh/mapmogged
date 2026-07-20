import { hexToHsv, hexToRgb, hsvToHex, rgbToHex } from "./color-picker-model.js";

function createInlineColorPicker(initialColor, onInput) {
  const picker = document.createElement("div");
  picker.className = "inline-color-picker";
  const field = document.createElement("div");
  field.className = "inline-color-field";
  field.tabIndex = 0;
  field.setAttribute("role", "slider");
  field.setAttribute("aria-label", "Color saturation and brightness");
  const handle = document.createElement("span");
  handle.className = "inline-color-handle";
  field.append(handle);

  const hue = document.createElement("input");
  hue.type = "range";
  hue.className = "inline-color-hue";
  hue.min = "0";
  hue.max = "359";
  hue.step = "1";
  hue.setAttribute("aria-label", "Color hue");
  const rgbRow = document.createElement("div");
  rgbRow.className = "inline-color-rgb-row";
  const redInput = createRgbChannelInput("R");
  const greenInput = createRgbChannelInput("G");
  const blueInput = createRgbChannelInput("B");
  const rgbInputs = [redInput.input, greenInput.input, blueInput.input];
  rgbRow.append(redInput.label, greenInput.label, blueInput.label);
  picker.append(field, hue, rgbRow);

  let hsv = hexToHsv(initialColor);

  const emit = () => {
    syncControls();
    onInput(hsvToHex(hsv));
  };
  const updateFromPointer = (event) => {
    const bounds = field.getBoundingClientRect();
    hsv.saturation = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    hsv.value = clamp(1 - (event.clientY - bounds.top) / bounds.height, 0, 1);
    emit();
  };

  field.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    field.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  field.addEventListener("pointermove", (event) => {
    if (!field.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event);
  });
  field.addEventListener("pointerup", (event) => {
    if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
  });
  field.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    if (event.key === "ArrowLeft") hsv.saturation = clamp(hsv.saturation - step, 0, 1);
    else if (event.key === "ArrowRight") hsv.saturation = clamp(hsv.saturation + step, 0, 1);
    else if (event.key === "ArrowUp") hsv.value = clamp(hsv.value + step, 0, 1);
    else if (event.key === "ArrowDown") hsv.value = clamp(hsv.value - step, 0, 1);
    else return;
    event.preventDefault();
    emit();
  });
  hue.addEventListener("input", () => {
    hsv.hue = Number(hue.value);
    emit();
  });
  for (const input of rgbInputs) {
    input.addEventListener("change", commitRgbInputs);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      input.blur();
    });
  }

  function commitRgbInputs() {
    const values = rgbInputs.map((input) => input.value.trim());
    const channels = values.map(Number);
    if (values.some((value) => !/^\d{1,3}$/.test(value)) || channels.some((channel) => channel > 255)) {
      syncControls();
      return;
    }
    hsv = hexToHsv(rgbToHex({ red: channels[0], green: channels[1], blue: channels[2] }));
    emit();
  }

  function syncControls() {
    const color = hsvToHex(hsv);
    const rgb = hexToRgb(color);
    field.style.background =
      `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.hue} 100% 50%))`;
    handle.style.left = `${hsv.saturation * 100}%`;
    handle.style.top = `${(1 - hsv.value) * 100}%`;
    handle.style.backgroundColor = color;
    hue.value = String(Math.round(hsv.hue));
    redInput.input.value = String(rgb.red);
    greenInput.input.value = String(rgb.green);
    blueInput.input.value = String(rgb.blue);
    field.setAttribute("aria-valuetext", color);
  }

  syncControls();
  return {
    element: picker,
    sync(color) {
      const nextColor = hsvToHex(hexToHsv(color));
      if (nextColor === hsvToHex(hsv)) return;
      hsv = hexToHsv(nextColor);
      syncControls();
    },
  };
}

function createRgbChannelInput(channel) {
  const label = document.createElement("label");
  label.className = "inline-color-rgb-channel";
  const text = document.createElement("span");
  text.textContent = channel;
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 3;
  input.autocomplete = "off";
  input.setAttribute("aria-label", `${channel} color channel, 0 to 255`);
  label.append(text, input);
  return { label, input };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export { createInlineColorPicker };
