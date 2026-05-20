const DEFAULT_CENTER = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;
const LOAD_CENTER_ZOOM = 4;
const SAMPLE_CENTER_LIMIT = 10000;
const ZOOM_BUTTON_STEP = 0.5;
const WHEEL_ZOOM_SENSITIVITY = 0.003;
const MAX_LATITUDE = 85.05112878;
const UPLOAD_BUTTON_LABEL = "Upload";
const UPLOAD_BUTTON_TITLE = "Upload Maps Timeline JSON and manual CSV";
const PRESET_COLORS = [
  "#2563eb",
  "#5e25eb",
  "#d525eb",
  "#eb258b",
  "#eb3625",
  "#ebad25",
  "#b2eb25",
  "#3beb25",
  "#25eb85",
  "#25daeb",
];
// Exact paths from @vscode/codicons src/icons/*.svg.
const CODICON_PATHS = {
  clearAll: [
    {
      d: "M13.5004 12.0004C13.7762 12.0006 14.0004 12.2245 14.0004 12.5004C14.0002 12.7761 13.7761 13.0002 13.5004 13.0004H2.50037C2.22449 13.0004 2.00056 12.7762 2.00037 12.5004C2.00037 12.2244 2.22437 12.0004 2.50037 12.0004H13.5004Z",
    },
    {
      d: "M13.5004 9.00037C13.7762 9.00056 14.0004 9.22449 14.0004 9.50037C14.0002 9.77608 13.7761 10.0002 13.5004 10.0004H2.50037C2.22449 10.0004 2.00056 9.7762 2.00037 9.50037C2.00037 9.22437 2.22437 9.00037 2.50037 9.00037H13.5004Z",
    },
    {
      d: "M13.5004 6.00037C13.7762 6.00056 14.0004 6.22449 14.0004 6.50037C14.0002 6.77608 13.7761 7.00017 13.5004 7.00037H7.50037C7.22449 7.00037 7.00056 6.7762 7.00037 6.50037C7.00037 6.22437 7.22437 6.00037 7.50037 6.00037H13.5004Z",
    },
    {
      d: "M5.50037 0.999023C5.63295 0.999115 5.76009 1.05179 5.85388 1.14551C5.94777 1.23939 6.00037 1.36722 6.00037 1.5C6.00027 1.63265 5.94769 1.75971 5.85388 1.85352L3.7074 4L5.85388 6.14551C5.94777 6.23939 6.00037 6.36722 6.00037 6.5C6.00027 6.63265 5.94769 6.75971 5.85388 6.85352C5.76008 6.94732 5.63302 6.99991 5.50037 7C5.36759 7 5.23976 6.9474 5.14587 6.85352L3.00037 4.70703L0.853882 6.85352C0.760077 6.94732 0.633017 6.99991 0.500366 7C0.36759 7 0.239761 6.9474 0.145874 6.85352C0.0521583 6.75972 -0.000519052 6.63258 -0.000610352 6.5C-0.000610354 6.36722 0.0519875 6.23939 0.145874 6.14551L2.29333 4L0.145874 1.85352C0.0521583 1.75972 -0.000519119 1.63258 -0.000610352 1.5C-0.000610351 1.36722 0.0519874 1.23939 0.145874 1.14551C0.239761 1.05162 0.36759 0.999023 0.500366 0.999023C0.63295 0.999115 0.76009 1.05179 0.853882 1.14551L3.00037 3.29297L5.14587 1.14551C5.23976 1.05162 5.36759 0.999023 5.50037 0.999023Z",
    },
    {
      d: "M13.5004 3.00037C13.7762 3.00056 14.0004 3.22449 14.0004 3.50037C14.0002 3.77608 13.7761 4.00017 13.5004 4.00037H7.50037C7.22449 4.00037 7.00056 3.7762 7.00037 3.50037C7.00037 3.22437 7.22437 3.00037 7.50037 3.00037H13.5004Z",
    },
  ],
  close: [
    {
      d: "M8.70701 8.00001L12.353 4.35401C12.548 4.15901 12.548 3.84201 12.353 3.64701C12.158 3.45201 11.841 3.45201 11.646 3.64701L8.00001 7.29301L4.35401 3.64701C4.15901 3.45201 3.84201 3.45201 3.64701 3.64701C3.45201 3.84201 3.45201 4.15901 3.64701 4.35401L7.29301 8.00001L3.64701 11.646C3.45201 11.841 3.45201 12.158 3.64701 12.353C3.74501 12.451 3.87301 12.499 4.00101 12.499C4.12901 12.499 4.25701 12.45 4.35501 12.353L8.00101 8.70701L11.647 12.353C11.745 12.451 11.873 12.499 12.001 12.499C12.129 12.499 12.257 12.45 12.355 12.353C12.55 12.158 12.55 11.841 12.355 11.646L8.70901 8.00001H8.70701Z",
    },
  ],
  collapseAll: [
    {
      d: "M14 4.27051C14.5999 4.62053 15 5.26009 15 6V11C15 13.21 13.21 15 11 15H6C5.26009 15 4.62053 14.5999 4.27051 14H11C12.65 14 14 12.65 14 11V4.27051Z",
    },
    {
      d: "M9.5 7C9.776 7 10 7.224 10 7.5C10 7.776 9.776 8 9.5 8H5.5C5.224 8 5 7.776 5 7.5C5 7.224 5.224 7 5.5 7H9.5Z",
    },
    {
      d: "M11 2C12.103 2 13 2.897 13 4V11C13 12.103 12.103 13 11 13H4C2.897 13 2 12.103 2 11V4C2 2.897 2.897 2 4 2H11ZM4 3C3.449 3 3 3.449 3 4V11C3 11.552 3.449 12 4 12H11C11.551 12 12 11.552 12 11V4C12 3.449 11.551 3 11 3H4Z",
      fillRule: "evenodd",
      clipRule: "evenodd",
    },
  ],
  question: [
    {
      d: "M8 11C8.41421 11 8.75 11.3358 8.75 11.75C8.75 12.1642 8.41421 12.5 8 12.5C7.58579 12.5 7.25 12.1642 7.25 11.75C7.25 11.3358 7.58579 11 8 11Z",
    },
    {
      d: "M8 4C9.262 4 10.25 4.988 10.25 6.25C10.25 7.333 9.68352 7.89852 9.22852 8.35352C8.82052 8.76052 8.5 9.082 8.5 9.75C8.5 10.026 8.276 10.25 8 10.25C7.724 10.25 7.5 10.026 7.5 9.75C7.5 8.667 8.06648 8.10148 8.52148 7.64648C8.92948 7.23948 9.25 6.918 9.25 6.25C9.25 5.538 8.712 5 8 5C7.288 5 6.75 5.538 6.75 6.25C6.75 6.526 6.526 6.75 6.25 6.75C5.974 6.75 5.75 6.526 5.75 6.25C5.75 4.988 6.738 4 8 4Z",
    },
    {
      d: "M8 1C11.86 1 15 4.14 15 8C15 11.86 11.86 15 8 15C4.14 15 1 11.86 1 8C1 4.14 4.14 1 8 1ZM8 2C4.691 2 2 4.691 2 8C2 11.309 4.691 14 8 14C11.309 14 14 11.309 14 8C14 4.691 11.309 2 8 2Z",
      fillRule: "evenodd",
      clipRule: "evenodd",
    },
  ],
  refresh: [
    {
      d: "M3 8C3 5.23858 5.23858 3 8 3C9.63527 3 11.0878 3.78495 12.0005 5H10C9.72386 5 9.5 5.22386 9.5 5.5C9.5 5.77614 9.72386 6 10 6H12.8904C12.8973 6.00014 12.9041 6.00014 12.911 6H13C13.2761 6 13.5 5.77614 13.5 5.5V2.5C13.5 2.22386 13.2761 2 13 2C12.7239 2 12.5 2.22386 12.5 2.5V4.03138C11.4009 2.78613 9.79253 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14C11.1301 14 13.6999 11.6035 13.9756 8.54488C14.0003 8.26985 13.7975 8.0268 13.5225 8.00202C13.2474 7.97723 13.0044 8.1801 12.9796 8.45512C12.75 11.003 10.6079 13 8 13C5.23858 13 3 10.7614 3 8Z",
    },
  ],
};

const elements = {
  fileInput: document.querySelector("#timelineFile"),
  fileLabel: document.querySelector("#fileLabel"),
  uploadButton: document.querySelector("#uploadButton"),
  processButton: document.querySelector("#processButton"),
  settingsToggleButton: document.querySelector("#settingsToggleButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  helpButton: document.querySelector("#helpButton"),
  instructionsModal: document.querySelector("#instructionsModal"),
  closeInstructionsButton: document.querySelector("#closeInstructionsButton"),
  minimizeButton: document.querySelector("#minimizeButton"),
  restoreButton: document.querySelector("#restoreButton"),
  clearLayersButton: document.querySelector("#clearLayersButton"),
  layerSection: document.querySelector("#layerSection"),
  layerList: document.querySelector("#layerList"),
  minSpeed: document.querySelector("#minSpeed"),
  maxSpeed: document.querySelector("#maxSpeed"),
  roundDigits: document.querySelector("#roundDigits"),
  styleSize: document.querySelector("#styleSize"),
  layerColor: document.querySelector("#layerColor"),
};

let selectedFiles = [];
let uploadLayers = [];
let processQueue = [];
let activeProcessingLayer = null;
let nextLayerId = 1;
let timelineMap = null;

setupPanelIconButton(elements.minimizeButton, "collapseAll", "Minimize controls");
setupPanelIconButton(elements.helpButton, "question", "Open instructions");
setupPanelIconButton(elements.closeInstructionsButton, "close", "Close instructions");
setupPanelIconButton(elements.clearLayersButton, "clearAll", "Clear all layers");
attachColorPresets(elements.layerColor);

elements.uploadButton.addEventListener("click", () => {
  elements.fileInput.click();
});

elements.fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(elements.fileInput.files ?? []);
  updateUploadButtonMeta();
  elements.processButton.disabled = selectedFiles.length === 0;
});

elements.processButton.addEventListener("click", processSelectedFiles);
elements.settingsToggleButton.addEventListener("click", () => {
  setSettingsVisible(elements.settingsPanel.hidden);
});
elements.helpButton.addEventListener("click", () => setInstructionsVisible(true));
elements.closeInstructionsButton.addEventListener("click", () => setInstructionsVisible(false));
elements.instructionsModal.addEventListener("click", (event) => {
  if (event.target === elements.instructionsModal) {
    setInstructionsVisible(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.instructionsModal.hidden) {
    setInstructionsVisible(false);
  }
});
elements.minimizeButton.addEventListener("click", () => setPanelCollapsed(true));
elements.restoreButton.addEventListener("click", () => setPanelCollapsed(false));
elements.clearLayersButton.addEventListener("click", clearAllLayers);

renderLayerList();

function processSelectedFiles() {
  if (!selectedFiles.length) return;

  const newLayers = selectedFiles.map((file) => createUploadLayer(file));
  uploadLayers.push(...newLayers);
  selectedFiles = [];
  elements.fileInput.value = "";
  updateUploadButtonMeta();
  elements.processButton.disabled = true;

  for (const layer of newLayers) {
    enqueueProcessLayer(layer);
  }

  renderLayerList();
}

function createUploadLayer(file) {
  return {
    id: nextLayerId++,
    file,
    fileType: getFileType(file),
    name: file.name,
    mode: getDefaultMapMode(),
    minSpeed: readNumber(elements.minSpeed, 0.5),
    maxSpeed: readNumber(elements.maxSpeed, 500),
    precision: readInteger(elements.roundDigits, 4, 1, 7),
    size: readNumber(elements.styleSize, 2.5),
    color: elements.layerColor.value || "#2563eb",
    status: "queued",
    progress: 0,
    stats: null,
    cleanedPoints: [],
    displayPoints: [],
    canvasLayer: null,
    worker: null,
    error: "",
  };
}

function enqueueProcessLayer(layer) {
  cancelLayerWork(layer);
  layer.status = "queued";
  layer.progress = 0;
  layer.error = "";
  layer.stats = null;
  layer.cleanedPoints = [];
  layer.displayPoints = [];
  layer.canvasLayer = null;
  processQueue.push(layer.id);
  processNextLayer();
}

function processNextLayer() {
  if (activeProcessingLayer || processQueue.length === 0) return;

  const layerId = processQueue.shift();
  const layer = uploadLayers.find((candidate) => candidate.id === layerId);

  if (!layer) {
    processNextLayer();
    return;
  }

  activeProcessingLayer = layer;
  layer.status = "processing";
  layer.progress = 0;
  renderLayerList();

  const worker = new Worker(new URL("./timeline-worker.js", import.meta.url), { type: "module" });
  layer.worker = worker;

  worker.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "progress") {
      layer.progress = message.percent;
      layer.stats = {
        ...(layer.stats ?? emptyStats()),
        rawCount: message.rawCount,
      };
      layer.keptCount = message.keptCount;
      renderLayerList();
      return;
    }

    if (message.type === "done") {
      layer.status = "ready";
      layer.progress = 100;
      layer.stats = message.stats;
      layer.cleanedPoints = message.points;
      layer.worker = null;
      worker.terminate();
      activeProcessingLayer = null;
      rebuildLayer(layer);
      renderAllMapLayers({ center: processQueue.length === 0 });
      renderLayerList();
      processNextLayer();
      return;
    }

    if (message.type === "error") {
      markLayerError(layer, message.error);
      worker.terminate();
      activeProcessingLayer = null;
      processNextLayer();
    }
  });

  worker.addEventListener("error", (event) => {
    markLayerError(layer, event.message || "Worker failed");
    worker.terminate();
    activeProcessingLayer = null;
    processNextLayer();
  });

  worker.postMessage({
    type: "parse",
    file: layer.file,
    options: {
      fileType: layer.fileType,
      minSpeed: layer.minSpeed,
      maxSpeed: layer.maxSpeed,
    },
  });
}

function markLayerError(layer, error) {
  layer.status = "error";
  layer.error = error;
  layer.worker = null;
  renderLayerList();
}

function cancelLayerWork(layer) {
  processQueue = processQueue.filter((id) => id !== layer.id);

  if (layer.worker) {
    layer.worker.terminate();
    layer.worker = null;
  }

  if (activeProcessingLayer?.id === layer.id) {
    activeProcessingLayer = null;
  }
}

function clearAllLayers() {
  for (const layer of uploadLayers) {
    cancelLayerWork(layer);
  }

  uploadLayers = [];
  processQueue = [];
  activeProcessingLayer = null;
  timelineMap.setLayers([]);
  renderLayerList();
}

function deleteLayer(layer) {
  const wasActive = activeProcessingLayer?.id === layer.id;
  cancelLayerWork(layer);
  uploadLayers = uploadLayers.filter((candidate) => candidate.id !== layer.id);
  renderAllMapLayers();
  renderLayerList();

  if (wasActive) {
    processNextLayer();
  }
}

function rebuildLayer(layer) {
  if (!layer.cleanedPoints.length || layer.status !== "ready") {
    layer.displayPoints = [];
    layer.canvasLayer = null;
    return;
  }

  layer.displayPoints =
    layer.mode === "points" ? buildRoundedPins(layer.cleanedPoints, layer.precision) : layer.cleanedPoints;
  layer.canvasLayer =
    layer.mode === "points"
      ? new PointCanvasLayer(layer.displayPoints, { color: layer.color, radius: layer.size })
      : new RouteCanvasLayer(layer.displayPoints, { color: layer.color, width: layer.size });
}

function renderAllMapLayers(options = {}) {
  for (const layer of uploadLayers) {
    if (layer.status === "ready" && !layer.canvasLayer) {
      rebuildLayer(layer);
    }
  }

  timelineMap.setLayers(uploadLayers.map((layer) => layer.canvasLayer).filter(Boolean));

  if (options.center) {
    centerOnLayerSampleAverage();
  }

  timelineMap.renderNow();
}

function buildRoundedPins(points, precision) {
  const digits = Math.max(1, Math.min(7, Math.round(precision)));
  const factor = 10 ** digits;
  const seen = new Set();
  const pins = [];

  for (const point of points) {
    const lat = Math.round(point[0] * factor) / factor;
    const lon = Math.round(point[1] * factor) / factor;
    const key = `${lat}:${lon}`;

    if (!seen.has(key)) {
      seen.add(key);
      pins.push([lat, lon, point[2], point[3], point[4], point[5]]);
    }
  }

  return pins;
}

function centerOnLayerSampleAverage() {
  const totalPoints = uploadLayers.reduce(
    (sum, layer) => sum + (layer.status === "ready" ? layer.displayPoints.length : 0),
    0,
  );
  if (!totalPoints) return;

  const step = Math.max(1, Math.floor(totalPoints / SAMPLE_CENTER_LIMIT));
  let seen = 0;
  let count = 0;
  let latTotal = 0;
  let lonTotal = 0;

  for (const layer of uploadLayers) {
    if (layer.status !== "ready") continue;

    for (const point of layer.displayPoints) {
      if (seen % step === 0) {
        latTotal += point[0];
        lonTotal += point[1];
        count += 1;
      }
      seen += 1;
    }
  }

  if (!count) return;

  timelineMap.setView([latTotal / count, lonTotal / count], LOAD_CENTER_ZOOM);
}

function renderLayerList() {
  const hasLayers = uploadLayers.length > 0;
  elements.layerSection.hidden = !hasLayers;
  elements.clearLayersButton.disabled = !hasLayers;

  if (!hasLayers) {
    elements.layerList.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const layer of uploadLayers) {
    fragment.append(createLayerCard(layer));
  }

  elements.layerList.replaceChildren(fragment);
}

function updateUploadButtonMeta() {
  elements.fileLabel.textContent = UPLOAD_BUTTON_LABEL;

  const title =
    selectedFiles.length === 0
      ? UPLOAD_BUTTON_TITLE
      : `${formatNumber(selectedFiles.length)} file${selectedFiles.length === 1 ? "" : "s"} selected`;
  elements.uploadButton.title = title;
  elements.uploadButton.setAttribute("aria-label", title);
}

function setSettingsVisible(isVisible) {
  elements.settingsPanel.hidden = !isVisible;
  elements.settingsToggleButton.setAttribute("aria-expanded", String(isVisible));
}

function setInstructionsVisible(isVisible) {
  elements.instructionsModal.hidden = !isVisible;
}

function createLayerCard(layer) {
  const card = document.createElement("div");
  card.className = "layer-card";

  const header = document.createElement("div");
  header.className = "layer-card-header";

  const textWrap = document.createElement("div");
  textWrap.style.minWidth = "0";

  const name = document.createElement("div");
  name.className = "layer-name";
  name.textContent = layer.name;

  const meta = document.createElement("div");
  meta.className = "layer-meta";
  meta.textContent = getLayerMeta(layer);

  textWrap.append(name, meta);

  const actionGroup = document.createElement("div");
  actionGroup.className = "layer-actions";

  const reprocessButton = createIconButton("refresh", "Reprocess layer");
  reprocessButton.disabled = layer.status === "processing";
  reprocessButton.addEventListener("click", () => {
    enqueueProcessLayer(layer);
    renderLayerList();
    renderAllMapLayers();
  });

  const deleteButton = createIconButton("close", "Delete layer");
  deleteButton.addEventListener("click", () => {
    deleteLayer(layer);
  });

  actionGroup.append(reprocessButton, deleteButton);
  header.append(textWrap, actionGroup);

  const controls = document.createElement("div");
  controls.className = "layer-controls";
  controls.append(
    createSegmentedControl(`layer-mode-${layer.id}`, "Mode", layer.mode, [
      ["points", "Points"],
      ["route", "Route"],
    ], (value) => {
      layer.mode = value;
      rebuildLayer(layer);
      renderAllMapLayers();
      renderLayerList();
    }),
    createColorControl("Color", layer.color, (value) => {
      layer.color = value;
      rebuildLayer(layer);
      renderAllMapLayers();
    }, "layer-span-3"),
    createNumberControl("Width", layer.size, 1, 12, 0.5, (value) => {
      layer.size = value;
      rebuildLayer(layer);
      renderAllMapLayers();
    }, "layer-span-3"),
    createNumberControl("Precision", layer.precision, 1, 7, 1, (value) => {
      layer.precision = Math.round(value);
      rebuildLayer(layer);
      renderAllMapLayers();
      renderLayerList();
    }, "layer-span-4"),
    createNumberControl("Min speed", layer.minSpeed, 0, 1000, 0.1, (value) => {
      layer.minSpeed = value;
    }, "layer-span-4"),
    createNumberControl("Max speed", layer.maxSpeed, 1, 5000, 10, (value) => {
      layer.maxSpeed = value;
    }, "layer-span-4"),
  );

  card.append(header, controls);
  return card;
}

function createSegmentedControl(name, label, value, options, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "layer-span-6";
  const text = document.createElement("span");
  text.textContent = label;
  const group = document.createElement("div");
  group.className = "segmented-control layer-segmented-control";

  for (const [optionValue, optionLabel] of options) {
    const item = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = optionValue;
    input.checked = optionValue === value;
    input.addEventListener("change", () => {
      if (input.checked) {
        onChange(input.value);
      }
    });

    const labelText = document.createElement("span");
    labelText.textContent = optionLabel;
    item.append(input, labelText);
    group.append(item);
  }

  wrapper.append(text, group);
  return wrapper;
}

function createIconButton(iconName, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "layer-icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createCodicon(iconName));
  return button;
}

function createCodicon(iconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const pathSpec of CODICON_PATHS[iconName]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathSpec.d);
    if (pathSpec.fillRule) {
      path.setAttribute("fill-rule", pathSpec.fillRule);
    }
    if (pathSpec.clipRule) {
      path.setAttribute("clip-rule", pathSpec.clipRule);
    }
    svg.append(path);
  }

  return svg;
}

function setupPanelIconButton(button, iconName, label) {
  button.textContent = "";
  button.classList.add("panel-icon-button");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createCodicon(iconName));
}

function createColorControl(label, value, onChange, className = "") {
  const wrapper = document.createElement("div");
  wrapper.className = ["color-control", className].filter(Boolean).join(" ");
  const text = document.createElement("span");
  text.textContent = label;
  const row = document.createElement("div");
  row.className = "color-input-row";
  const input = document.createElement("input");
  input.type = "color";
  input.value = value;
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => onChange(input.value));
  row.append(input, createColorPresetGroup(input, onChange));
  wrapper.append(text, row);
  return wrapper;
}

function attachColorPresets(input) {
  input.closest(".color-input-row")?.querySelector("[data-color-presets]")?.replaceWith(createColorPresetGroup(input));
}

function createColorPresetGroup(input, onChange = () => {}) {
  const group = document.createElement("div");
  group.className = "color-presets";
  group.dataset.colorPresets = "";
  group.setAttribute("aria-label", "Preset colors");

  for (const color of PRESET_COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-preset";
    button.style.backgroundColor = color;
    button.title = color;
    button.setAttribute("aria-label", `Use color ${color}`);
    button.addEventListener("click", () => {
      input.value = color;
      onChange(color);
      syncColorPresetSelection(group, color);
    });
    group.append(button);
  }

  input.addEventListener("input", () => syncColorPresetSelection(group, input.value));
  syncColorPresetSelection(group, input.value);
  return group;
}

function syncColorPresetSelection(group, activeColor) {
  for (const button of group.querySelectorAll(".color-preset")) {
    const isActive = button.title.toLowerCase() === activeColor.toLowerCase();
    button.classList.toggle("is-selected", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function createNumberControl(label, value, min, max, step, onChange, className = "") {
  const wrapper = document.createElement("label");
  if (className) {
    wrapper.className = className;
  }
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) {
      onChange(Math.max(min, Math.min(max, next)));
    }
  });
  wrapper.append(text, input);
  return wrapper;
}

function getLayerMeta(layer) {
  const type = layer.fileType.toUpperCase();
  const status = layer.status === "error" ? `Error: ${layer.error}` : layer.status;
  const stats = layer.stats ?? emptyStats();
  const kept = layer.status === "processing" ? layer.keptCount ?? 0 : layer.cleanedPoints.length;
  const mapped = layer.displayPoints.length;
  return `${type} · ${status} · raw ${formatNumber(stats.rawCount)} · kept ${formatNumber(
    kept,
  )} · map ${formatNumber(mapped)}`;
}

function emptyStats() {
  return {
    rawCount: 0,
    skippedSlow: 0,
    skippedFast: 0,
    skippedInvalid: 0,
    outOfOrderCount: 0,
  };
}

function setPanelCollapsed(isCollapsed) {
  document.body.classList.toggle("is-panel-collapsed", isCollapsed);
  timelineMap.render();
}

function getDefaultMapMode() {
  return document.querySelector('input[name="mapMode"]:checked')?.value ?? "points";
}

function getFileType(file) {
  return file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function readInteger(input, fallback, min, max) {
  const value = Math.round(readNumber(input, fallback));
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

class TimelineMap {
  constructor(container) {
    this.container = container;
    this.tilePane = document.createElement("div");
    this.tilePane.className = "map-tile-pane";
    this.overlay = document.createElement("canvas");
    this.overlay.className = "timeline-overlay-canvas";
    this.controls = createMapControls();
    this.attribution = createAttribution();
    this.tiles = new Map();
    this.center = { lat: DEFAULT_CENTER[0], lon: DEFAULT_CENTER[1] };
    this.zoom = DEFAULT_ZOOM;
    this.layers = [];
    this.frame = null;
    this.drag = null;

    this.container.append(this.tilePane, this.overlay, this.controls, this.attribution);
    this.bindEvents();
    new ResizeObserver(() => this.render()).observe(this.container);
  }

  setView([lat, lon], zoom = this.zoom) {
    this.center = { lat: clampLatitude(lat), lon: wrapLongitude(lon) };
    this.zoom = clampZoom(zoom);
    this.render();
  }

  setLayers(layers) {
    this.layers = layers;
    this.render();
  }

  latLonToContainerPoint(lat, lon) {
    const point = projectLatLon(lat, lon, this.zoom);
    const worldSize = TILE_SIZE * 2 ** this.zoom;
    const center = projectLatLon(this.center.lat, this.center.lon, this.zoom);
    point.x += Math.round((center.x - point.x) / worldSize) * worldSize;
    const topLeft = this.getTopLeft();
    return {
      x: point.x - topLeft.x,
      y: point.y - topLeft.y,
    };
  }

  segmentIntersectsView(startPoint, endPoint, pad = 64) {
    const start = this.latLonToContainerPoint(startPoint[0], startPoint[1]);
    const end = this.latLonToContainerPoint(endPoint[0], endPoint[1]);
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    return {
      end,
      start,
      visible:
        maxX >= -pad &&
        minX <= this.container.clientWidth + pad &&
        maxY >= -pad &&
        minY <= this.container.clientHeight + pad,
    };
  }

  bindEvents() {
    this.controls
      .querySelector("[data-zoom-in]")
      .addEventListener("click", () => this.zoomBy(ZOOM_BUTTON_STEP));
    this.controls
      .querySelector("[data-zoom-out]")
      .addEventListener("click", () => this.zoomBy(-ZOOM_BUTTON_STEP));

    this.container.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".map-controls")) return;
      this.container.setPointerCapture(event.pointerId);
      this.container.classList.add("is-dragging");
      this.drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        center: projectLatLon(this.center.lat, this.center.lon, this.zoom),
      };
    });

    this.container.addEventListener("pointermove", (event) => {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const nextCenter = {
        x: this.drag.center.x - (event.clientX - this.drag.x),
        y: this.drag.center.y - (event.clientY - this.drag.y),
      };
      this.center = unprojectPoint(nextCenter, this.zoom);
      this.render();
    });

    this.container.addEventListener("pointerup", (event) => this.endDrag(event.pointerId));
    this.container.addEventListener("pointercancel", (event) => this.endDrag(event.pointerId));
    this.container.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const delta = clamp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY, -0.35, 0.35);
        this.zoomAround(event.clientX, event.clientY, delta);
      },
      { passive: false },
    );
    this.container.addEventListener("dblclick", (event) => {
      event.preventDefault();
      this.zoomAround(event.clientX, event.clientY, 1);
    });
  }

  endDrag(pointerId) {
    if (!this.drag || this.drag.pointerId !== pointerId) return;
    this.drag = null;
    this.container.classList.remove("is-dragging");
  }

  zoomBy(delta) {
    const rect = this.container.getBoundingClientRect();
    this.zoomAround(rect.left + rect.width / 2, rect.top + rect.height / 2, delta);
  }

  zoomAround(clientX, clientY, delta) {
    const nextZoom = clampZoom(this.zoom + delta);
    if (nextZoom === this.zoom) return;

    const rect = this.container.getBoundingClientRect();
    const offset = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    const before = this.containerPointToLatLon(offset.x, offset.y);
    this.zoom = nextZoom;
    const world = projectLatLon(before.lat, before.lon, nextZoom);
    const centerWorld = {
      x: world.x - offset.x + this.container.clientWidth / 2,
      y: world.y - offset.y + this.container.clientHeight / 2,
    };
    this.center = unprojectPoint(centerWorld, nextZoom);
    this.render();
  }

  containerPointToLatLon(x, y) {
    const topLeft = this.getTopLeft();
    return unprojectPoint({ x: topLeft.x + x, y: topLeft.y + y }, this.zoom);
  }

  getTopLeft() {
    const center = projectLatLon(this.center.lat, this.center.lon, this.zoom);
    return {
      x: center.x - this.container.clientWidth / 2,
      y: center.y - this.container.clientHeight / 2,
    };
  }

  render() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderNow();
    });
  }

  renderNow() {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.renderTiles();
    this.renderOverlay();
  }

  renderTiles() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;

    const tileZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(this.zoom)));
    const tileScale = 2 ** tileZoom;
    const displayScale = 2 ** (this.zoom - tileZoom);
    const topLeft = this.getTopLeft();
    const tileTopLeft = {
      x: topLeft.x / displayScale,
      y: topLeft.y / displayScale,
    };
    const startX = Math.floor(tileTopLeft.x / TILE_SIZE) - 1;
    const endX = Math.floor((tileTopLeft.x + width / displayScale) / TILE_SIZE) + 1;
    const startY = Math.max(0, Math.floor(tileTopLeft.y / TILE_SIZE) - 1);
    const endY = Math.min(
      tileScale - 1,
      Math.floor((tileTopLeft.y + height / displayScale) / TILE_SIZE) + 1,
    );
    const visible = new Set();

    for (let tileX = startX; tileX <= endX; tileX += 1) {
      const wrappedX = modulo(tileX, tileScale);

      for (let tileY = startY; tileY <= endY; tileY += 1) {
        const key = `${tileZoom}:${tileX}:${tileY}`;
        visible.add(key);

        let tile = this.tiles.get(key);
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "map-tile";
          tile.alt = "";
          tile.decoding = "async";
          tile.draggable = false;
          tile.src = `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${tileY}.png`;
          this.tiles.set(key, tile);
          this.tilePane.append(tile);
        }

        tile.style.width = `${TILE_SIZE * displayScale}px`;
        tile.style.height = `${TILE_SIZE * displayScale}px`;
        tile.style.transform = `translate(${Math.round(
          tileX * TILE_SIZE * displayScale - topLeft.x,
        )}px, ${Math.round(tileY * TILE_SIZE * displayScale - topLeft.y)}px)`;
      }
    }

    for (const [key, tile] of this.tiles) {
      if (!visible.has(key)) {
        tile.remove();
        this.tiles.delete(key);
      }
    }
  }

  renderOverlay() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    this.overlay.width = width * ratio;
    this.overlay.height = height * ratio;
    this.overlay.style.width = `${width}px`;
    this.overlay.style.height = `${height}px`;

    const ctx = this.overlay.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const layer of this.layers) {
      layer.draw(ctx, this);
    }
  }
}

class PointCanvasLayer {
  constructor(points, options = {}) {
    this.points = points;
    this.pointCount = points.length;
    this.options = options;
  }

  draw(ctx, map) {
    ctx.fillStyle = this.options.color || "#2563eb";
    ctx.globalAlpha = 0.72;
    const radius = this.options.radius || 2;
    const pad = 12;

    for (const point of this.points) {
      const pixel = map.latLonToContainerPoint(point[0], point[1]);
      if (
        pixel.x < -pad ||
        pixel.x > map.container.clientWidth + pad ||
        pixel.y < -pad ||
        pixel.y > map.container.clientHeight + pad
      ) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class RouteCanvasLayer {
  constructor(points, options = {}) {
    this.points = points;
    this.pointCount = points.length;
    this.options = options;
  }

  draw(ctx, map) {
    ctx.lineWidth = this.options.width || 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = this.options.color || "#dc2626";
    ctx.globalAlpha = 0.84;

    let previous = null;
    let previousYear = null;
    let drawing = false;

    ctx.beginPath();
    for (const point of this.points) {
      const year = point[5];

      if (!previous || year !== previousYear) {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
        previous = point;
        previousYear = year;
        continue;
      }

      const segment = map.segmentIntersectsView(previous, point);
      if (segment.visible) {
        const { start, end } = segment;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        drawing = true;
      }

      previous = point;
      previousYear = year;
    }

    if (drawing) {
      ctx.stroke();
    }
  }
}

function createMapControls() {
  const controls = document.createElement("div");
  controls.className = "map-controls";
  controls.innerHTML = `
    <button type="button" data-zoom-in aria-label="Zoom in">+</button>
    <button type="button" data-zoom-out aria-label="Zoom out">-</button>
  `;
  return controls;
}

function createAttribution() {
  const attribution = document.createElement("div");
  attribution.className = "map-attribution";
  attribution.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  return attribution;
}

function projectLatLon(lat, lon, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const safeLat = clampLatitude(lat);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);

  return {
    x: ((wrapLongitude(lon) + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize,
  };
}

function unprojectPoint(point, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const lon = (point.x / worldSize) * 360 - 180;
  const mercator = Math.PI - (2 * Math.PI * point.y) / worldSize;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercator));

  return {
    lat: clampLatitude(lat),
    lon: wrapLongitude(lon),
  };
}

function clampLatitude(lat) {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

function wrapLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clampZoom(zoom) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

timelineMap = new TimelineMap(document.querySelector("#map"));
timelineMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
