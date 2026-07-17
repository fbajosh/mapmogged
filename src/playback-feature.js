import { PlaybackController } from "./playback-controller.js";
import {
  deriveMultiplier,
  derivePlaybackDuration,
  durationValueToMs,
  formatDistance,
  formatElapsed,
  formatLocalDate,
  getPreferredDurationUnit,
  samplePlaybackAt,
} from "./playback-model.js";
import { PlaybackCanvasLayer } from "./playback-renderer.js";
import { RegionLookupTracker, loadRegionFeatures } from "./region-lookup.js";
import {
  RevealedPathBounds,
  getPredictedSourceElapsedMs,
  smoothCamera,
} from "./playback-camera.js";

const INFO_UPDATE_INTERVAL_MS = 100;
const PREPARE_DEBOUNCE_MS = 180;
const PLAYBACK_START_DELAY_MS = 500;
const PANEL_REVEAL_DELAY_MS = 2000;

class PlaybackFeature {
  constructor(options) {
    this.map = options.map;
    this.button = options.button;
    this.getLayers = options.getLayers;
    this.getSpeedUnitId = options.getSpeedUnitId;
    this.getNormalCanvasLayers = options.getNormalCanvasLayers;
    this.createIcon = options.createIcon;
    this.elements = getElements();
    this.controller = new PlaybackController({
      onFrame: () => this.handleFrame(),
      onStateChange: (status) => this.handleStateChange(status),
    });
    this.playbackLayer = null;
    this.worker = null;
    this.preparationId = 0;
    this.prepareTimer = null;
    this.pendingPlayTimer = null;
    this.panelRevealTimer = null;
    this.isOpen = false;
    this.isPanelHidden = false;
    this.lastFocused = null;
    this.lastInfoUpdatedAt = -Infinity;
    this.regionFeaturesPromise = null;
    this.regionTracker = new RegionLookupTracker();
    this.revealedPathBounds = new RevealedPathBounds();
    this.predictedPathBounds = new RevealedPathBounds();
    this.lastAutoFitAt = null;
    this.currentSnapshot = null;
    this.error = "";

    this.setupIcons();
    this.bindEvents();
    this.syncRateFields();
    this.syncAutoFitFields();
    this.refreshAvailability();
    this.syncUi();
  }

  setupIcons() {
    this.elements.closeButton.replaceChildren(this.createIcon("close"));
    this.elements.playButton.replaceChildren(this.createIcon("play"));
    this.elements.pauseButton.replaceChildren(this.createIcon("debugPause"));
    this.elements.resetButton.replaceChildren(this.createIcon("debugRestart"));
  }

  bindEvents() {
    this.button.addEventListener("click", () => {
      if (this.isOpen) this.close();
      else this.open();
    });
    this.elements.closeButton.addEventListener("click", () => this.close());
    this.elements.modal.addEventListener("keydown", (event) => this.handleDialogKeydown(event));
    this.elements.restoreButton.addEventListener("click", (event) => {
      if (!this.isOpen || !this.isPanelHidden) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.showPanel();
    }, true);
    this.elements.info.addEventListener("click", () => {
      if (this.isOpen && this.isPanelHidden) this.showPanel();
    });
    this.elements.info.addEventListener("keydown", (event) => {
      if (!this.isOpen || !this.isPanelHidden || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      this.showPanel();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.isOpen || !this.isPanelHidden) return;
      event.preventDefault();
      event.stopPropagation();
      this.showPanel();
    });

    for (const input of this.elements.rateModeInputs) {
      input.addEventListener("change", () => {
        this.syncRateFields();
        this.applyRate();
      });
    }
    this.elements.multiplier.addEventListener("input", () => this.applyRate());
    this.elements.duration.addEventListener("input", () => this.applyRate());
    this.elements.durationUnit.addEventListener("change", () => this.applyRate());

    this.elements.resampleValue.addEventListener("input", () => this.queuePrepare());
    for (const input of this.elements.resampleUnitInputs) {
      input.addEventListener("change", () => this.queuePrepare());
    }
    for (const input of this.elements.resampleModeInputs) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.playbackLayer?.setPathMode(this.getResampleMode());
        this.resetAutoFitState();
        this.handleFrame();
      });
    }
    for (const input of this.elements.previewInputs) {
      input.addEventListener("change", () => {
        if (!input.checked || !this.playbackLayer) return;
        this.playbackLayer.setPreviewAlpha(Number(input.value));
        this.map.renderOverlay();
      });
    }
    for (const input of this.elements.autoFitInputs) {
      input.addEventListener("change", () => this.handleAutoFitSettingsChange({
        resetBounds: true,
        restartEasing: true,
        applyNow: true,
      }));
    }
    for (const input of [this.elements.startingZoom, this.elements.pathMargin]) {
      input.addEventListener("input", () => this.handleAutoFitSettingsChange());
      input.addEventListener("change", () => this.handleAutoFitSettingsChange({
        restartEasing: true,
        applyNow: true,
      }));
    }
    this.elements.smoothing.addEventListener("input", () => this.handleAutoFitSettingsChange({
      resetPrediction: true,
    }));
    this.elements.smoothing.addEventListener("change", () => this.handleAutoFitSettingsChange({
      resetPrediction: true,
    }));
    this.elements.showInfo.addEventListener("change", () => {
      this.syncInfoVisibility();
      if (this.elements.showInfo.checked) {
        this.ensureRegionFeatures();
        this.refreshInfo(true);
      }
    });

    this.elements.playButton.addEventListener("click", () => this.play());
    this.elements.pauseButton.addEventListener("click", () => this.controller.pause());
    this.elements.resetButton.addEventListener("click", () => {
      this.cancelPendingPlay();
      this.cancelPanelReveal();
      this.regionTracker.reset();
      this.resetAutoFitState();
      this.controller.reset();
      this.refreshInfo(true);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.cancelPendingPlay();
        this.controller.pause();
      }
    });
  }

  open() {
    if (this.button.disabled) return;
    this.isOpen = true;
    this.lastFocused = document.activeElement;
    document.body.classList.add("is-playback-open");
    document.body.classList.remove("is-playback-panel-hidden");
    this.isPanelHidden = false;
    this.elements.modal.hidden = false;
    this.button.setAttribute("aria-expanded", "true");
    this.syncRateFields();
    this.syncInfoVisibility();
    this.error = "";
    if (this.controller.sequence && this.playbackLayer) {
      this.map.setLayers([this.playbackLayer]);
      this.handleFrame();
    } else {
      this.prepare();
    }
    if (this.elements.showInfo.checked) this.ensureRegionFeatures();
    this.elements.closeButton.focus();
    this.syncUi();
  }

  close() {
    if (!this.isOpen) return;
    this.cancelPendingPlay();
    this.cancelPanelReveal();
    this.controller.pause();
    this.isOpen = false;
    this.isPanelHidden = false;
    document.body.classList.remove("is-playback-open");
    document.body.classList.remove("is-playback-panel-hidden");
    this.elements.modal.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    this.elements.info.hidden = true;
    this.syncInfoRevealTarget();
    this.map.setLayers(this.getNormalCanvasLayers());
    this.map.renderNow();
    if (this.lastFocused instanceof HTMLElement) this.lastFocused.focus();
  }

  play() {
    if (!this.controller.sequence) {
      this.prepare(true);
      return;
    }
    const multiplier = this.getMultiplier();
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      this.setError("Enter a playback multiplier or total time greater than zero.");
      return;
    }
    const autoFitError = this.getAutoFitError();
    if (autoFitError) {
      this.setError(autoFitError);
      return;
    }
    this.setError("");
    const isReplay = this.controller.status === "finished";
    if (isReplay) {
      this.regionTracker.reset();
      this.lastInfoUpdatedAt = -Infinity;
      this.resetAutoFitState();
      this.controller.reset();
    }
    this.cancelPendingPlay();
    this.cancelPanelReveal();
    this.hidePanel();
    this.pendingPlayTimer = window.setTimeout(() => {
      this.pendingPlayTimer = null;
      if (!this.isOpen || document.hidden) {
        this.syncUi();
        return;
      }
      this.controller.play(multiplier);
      this.syncUi();
    }, PLAYBACK_START_DELAY_MS);
    this.syncUi();
  }

  hidePanel() {
    if (!this.isOpen || this.isPanelHidden) return;
    this.isPanelHidden = true;
    document.body.classList.add("is-playback-panel-hidden");
    this.syncInfoRevealTarget();
    if (!this.elements.info.hidden) this.elements.info.focus();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  showPanel() {
    if (!this.isOpen || !this.isPanelHidden) return;
    this.cancelPanelReveal();
    this.isPanelHidden = false;
    document.body.classList.remove("is-playback-panel-hidden");
    this.syncInfoRevealTarget();
    const focusTarget = this.controller.status === "playing"
      ? this.elements.pauseButton
      : this.elements.closeButton;
    focusTarget.focus();
  }

  syncInfoRevealTarget() {
    if (this.isOpen && this.isPanelHidden) {
      this.elements.info.setAttribute("role", "button");
      this.elements.info.setAttribute("tabindex", "0");
      this.elements.info.setAttribute("aria-label", "Playback information. Show playback controls");
      return;
    }
    this.elements.info.removeAttribute("role");
    this.elements.info.removeAttribute("tabindex");
    this.elements.info.setAttribute("aria-label", "Playback information");
  }

  handleStateChange(status) {
    if (status === "finished" && this.isOpen && this.isPanelHidden) this.schedulePanelReveal();
    else if (status !== "finished") this.cancelPanelReveal();
    this.syncUi();
  }

  schedulePanelReveal() {
    this.cancelPanelReveal();
    this.panelRevealTimer = window.setTimeout(() => {
      this.panelRevealTimer = null;
      this.showPanel();
    }, PANEL_REVEAL_DELAY_MS);
  }

  cancelPanelReveal() {
    if (this.panelRevealTimer === null) return;
    window.clearTimeout(this.panelRevealTimer);
    this.panelRevealTimer = null;
  }

  cancelPendingPlay() {
    if (this.pendingPlayTimer === null) return;
    window.clearTimeout(this.pendingPlayTimer);
    this.pendingPlayTimer = null;
    this.syncUi();
  }

  refreshAvailability() {
    const layers = this.getLayers();
    const isBusy = layers.some((layer) => ["queued", "processing"].includes(layer.status));
    const hasPlayable = layers.some((layer) => getLayerDurationMs(layer) > 0);
    this.button.disabled = isBusy || !hasPlayable;
    const label = isBusy
      ? "Play timeline (wait for layers to finish processing)"
      : hasPlayable
        ? "Play timeline"
        : "Play timeline (load a layer with timestamps first)";
    this.button.title = label;
    this.button.setAttribute("aria-label", label);
  }

  invalidateData() {
    this.cancelPendingPlay();
    this.cancelPanelReveal();
    this.clearPreparation();
    this.controller.invalidate();
    this.playbackLayer = null;
    this.currentSnapshot = null;
    this.regionTracker.reset();
    this.resetAutoFitState();
    this.refreshAvailability();
    if (this.isOpen && !this.button.disabled) this.queuePrepare();
    else if (this.isOpen) this.close();
  }

  refreshInfo(force = false, forceRegionLookup = false) {
    if (!this.isOpen || !this.elements.showInfo.checked || !this.currentSnapshot) {
      this.syncInfoVisibility();
      return;
    }

    const now = performance.now();
    if (!force && now - this.lastInfoUpdatedAt < INFO_UPDATE_INTERVAL_MS) return;
    this.lastInfoUpdatedAt = now;
    const snapshot = this.currentSnapshot;
    const covered = formatDistance(snapshot.distanceCoveredM, this.getSpeedUnitId());
    const total = formatDistance(snapshot.totalDistanceM, this.getSpeedUnitId());
    const elapsed = formatElapsed(snapshot.sourceElapsedMs);
    this.elements.distanceInfo.textContent = `${covered.text} / ${total.text} ${covered.unit}`;
    this.elements.timeInfo.textContent = `${formatLocalDate(snapshot.timeMs)} (${elapsed.text} ${elapsed.unit})`;

    const regionResult = this.regionTracker.update(snapshot.lat, snapshot.lon, now, {
      force: forceRegionLookup,
    });
    this.elements.regionInfo.textContent = regionResult.label;
    this.elements.regionInfo.hidden = !regionResult.label;
    this.elements.info.hidden = false;
  }

  syncInfoVisibility() {
    const visible = this.isOpen && this.elements.showInfo.checked && Boolean(this.currentSnapshot);
    this.elements.info.hidden = !visible;
  }

  async ensureRegionFeatures() {
    if (!this.regionFeaturesPromise) {
      this.regionFeaturesPromise = loadRegionFeatures()
        .then(({ features }) => {
          this.regionTracker.setFeatures(features);
          this.refreshInfo(true);
          return features;
        })
        .catch(() => {
          this.regionTracker.setFeatures([]);
          return [];
        });
    }
    return this.regionFeaturesPromise;
  }

  queuePrepare() {
    this.clearPrepareTimer();
    this.controller.pause();
    this.prepareTimer = window.setTimeout(() => this.prepare(), PREPARE_DEBOUNCE_MS);
  }

  prepare(playWhenReady = false) {
    this.clearPreparation();
    this.resetAutoFitState();
    const intervalMs = this.getResampleIntervalMs();
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      this.setError("Enter a resampling interval greater than zero.");
      this.controller.setError();
      return;
    }

    const layers = this.getLayers()
      .filter((layer) => getLayerDurationMs(layer) > 0)
      .map((layer) => ({
        id: layer.id,
        status: layer.status,
        color: layer.color,
        size: layer.size,
        cleanedPoints: layer.cleanedPoints,
      }));
    if (!layers.length) return;

    this.setError("");
    this.controller.setPreparing();
    const id = ++this.preparationId;
    const worker = new Worker(new URL("./playback-worker.js", import.meta.url), { type: "module" });
    this.worker = worker;
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message.id !== this.preparationId || worker !== this.worker) return;
      worker.terminate();
      this.worker = null;

      if (message.type === "error") {
        this.setError(message.error || "Could not prepare playback.");
        this.controller.setError();
        return;
      }

      this.playbackLayer = new PlaybackCanvasLayer(message.sequence, {
        previewAlpha: this.getPreviewAlpha(),
        pathMode: this.getResampleMode(),
      });
      this.controller.setSequence(message.sequence);
      if (this.isOpen) this.map.setLayers([this.playbackLayer]);
      this.syncRateFields();
      if (playWhenReady) this.play();
    });
    worker.addEventListener("error", () => {
      if (worker !== this.worker) return;
      worker.terminate();
      this.worker = null;
      this.setError("Could not prepare playback.");
      this.controller.setError();
    });
    worker.postMessage({ type: "build", id, layers, intervalMs });
  }

  handleFrame() {
    const sequence = this.controller.sequence;
    if (!sequence || !this.playbackLayer) return;
    const pathMode = this.getResampleMode();
    this.currentSnapshot = samplePlaybackAt(sequence, this.controller.sourceElapsedMs, { pathMode });
    this.playbackLayer.setSnapshot(this.currentSnapshot);
    if (this.isOpen) {
      this.applyAutoFit();
      this.map.renderOverlay();
      const isFinalLocation = this.currentSnapshot.sourceElapsedMs >= sequence.sourceDurationMs;
      this.refreshInfo(isFinalLocation, isFinalLocation);
    }
  }

  applyRate() {
    this.syncRateFields();
    const multiplier = this.getMultiplier();
    if (Number.isFinite(multiplier) && multiplier > 0) {
      this.controller.setMultiplier(multiplier);
      this.predictedPathBounds.reset();
    }
    this.setError(
      Number.isFinite(multiplier) && multiplier > 0
        ? this.getAutoFitError()
        : "Enter a playback multiplier or total time greater than zero.",
    );
    this.syncUi();
  }

  syncRateFields() {
    const mode = this.getRateMode();
    const sourceDurationMs = this.controller.sequence?.sourceDurationMs ?? getTotalSourceDurationMs(this.getLayers());
    this.elements.multiplier.disabled = mode !== "multiplier";
    this.elements.duration.disabled = mode !== "duration";
    this.elements.durationUnit.disabled = mode !== "duration";

    if (mode === "duration") {
      const durationMs = durationValueToMs(this.elements.duration.value, this.elements.durationUnit.value);
      const multiplier = deriveMultiplier(sourceDurationMs, durationMs);
      this.elements.multiplier.value = Number.isFinite(multiplier) ? formatInputNumber(multiplier) : "";
    } else {
      const durationMs = derivePlaybackDuration(sourceDurationMs, Number(this.elements.multiplier.value));
      if (Number.isFinite(durationMs)) {
        this.elements.durationUnit.value = getPreferredDurationUnit(durationMs);
      }
      const unitMs = durationValueToMs(1, this.elements.durationUnit.value);
      this.elements.duration.value = Number.isFinite(durationMs) && Number.isFinite(unitMs)
        ? formatInputNumber(durationMs / unitMs)
        : "";
    }
  }

  syncUi() {
    const status = this.controller.status;
    const validRate = Number.isFinite(this.getMultiplier()) && this.getMultiplier() > 0;
    const validAutoFit = !this.isAutoFitEnabled() || Boolean(this.getAutoFitSettings());
    this.elements.playButton.disabled =
      !validRate || !validAutoFit || this.pendingPlayTimer !== null || ["preparing", "playing"].includes(status);
    this.elements.pauseButton.disabled = status !== "playing";
    this.elements.resetButton.disabled = !this.controller.sequence || status === "preparing";
    const labels = {
      idle: "Ready",
      preparing: "Preparing playback…",
      ready: "Ready",
      playing: "Playing",
      paused: "Paused",
      finished: "Finished",
      error: "Playback needs attention",
    };
    this.elements.status.textContent = this.pendingPlayTimer !== null ? "Starting playback…" : labels[status] ?? "Ready";
  }

  getRateMode() {
    return this.elements.rateModeInputs.find((input) => input.checked)?.value ?? "duration";
  }

  getMultiplier() {
    if (this.getRateMode() === "multiplier") return Number(this.elements.multiplier.value);
    const durationMs = durationValueToMs(this.elements.duration.value, this.elements.durationUnit.value);
    const sourceDurationMs = this.controller.sequence?.sourceDurationMs ?? getTotalSourceDurationMs(this.getLayers());
    return deriveMultiplier(sourceDurationMs, durationMs);
  }

  getResampleIntervalMs() {
    const unit = this.elements.resampleUnitInputs.find((input) => input.checked)?.value ?? "minutes";
    return durationValueToMs(this.elements.resampleValue.value, unit);
  }

  getPreviewAlpha() {
    return Number(this.elements.previewInputs.find((input) => input.checked)?.value ?? 0.3);
  }

  getResampleMode() {
    return this.elements.resampleModeInputs.find((input) => input.checked)?.value === "tracking-only"
      ? "tracking-only"
      : "resampled";
  }

  isAutoFitEnabled() {
    return this.elements.autoFitInputs.find((input) => input.checked)?.value === "on";
  }

  getAutoFitSettings() {
    if (!this.isAutoFitEnabled()) return null;
    const startingZoom = Number(this.elements.startingZoom.value);
    const marginPx = Number(this.elements.pathMargin.value);
    const smoothingSeconds = Number(this.elements.smoothing.value);
    if (!Number.isFinite(startingZoom) || startingZoom < 2 || startingZoom > 18) return null;
    if (!Number.isFinite(marginPx) || marginPx < 0) return null;
    if (!Number.isFinite(smoothingSeconds) || smoothingSeconds < 0) return null;
    return { startingZoom, marginPx, smoothingSeconds };
  }

  getAutoFitError() {
    if (!this.isAutoFitEnabled()) return "";
    const startingZoom = Number(this.elements.startingZoom.value);
    if (!Number.isFinite(startingZoom) || startingZoom < 2 || startingZoom > 18) {
      return "Starting zoom must be between 2 and 18.";
    }
    const marginPx = Number(this.elements.pathMargin.value);
    if (!Number.isFinite(marginPx) || marginPx < 0) return "Path margin must be zero or greater.";
    const smoothingSeconds = Number(this.elements.smoothing.value);
    if (!Number.isFinite(smoothingSeconds) || smoothingSeconds < 0) {
      return "Smoothing must be zero or greater.";
    }
    return "";
  }

  syncAutoFitFields() {
    const disabled = !this.isAutoFitEnabled();
    this.elements.startingZoom.disabled = disabled;
    this.elements.pathMargin.disabled = disabled;
    this.elements.smoothing.disabled = disabled;
  }

  handleAutoFitSettingsChange(options = {}) {
    this.syncAutoFitFields();
    const autoFitError = this.getAutoFitError();
    const multiplier = this.getMultiplier();
    const error = autoFitError || (
      Number.isFinite(multiplier) && multiplier > 0
        ? ""
        : "Enter a playback multiplier or total time greater than zero."
    );
    this.setError(error);
    this.syncUi();
    if (!error && options.resetBounds) {
      this.revealedPathBounds.reset();
      this.predictedPathBounds.reset();
    }
    if (!error && options.resetPrediction) this.predictedPathBounds.reset();
    if (!error && options.restartEasing) this.lastAutoFitAt = null;
    if (!error && options.applyNow && this.isAutoFitEnabled() && this.currentSnapshot) {
      this.handleFrame();
    }
  }

  resetAutoFitState() {
    this.revealedPathBounds.reset();
    this.predictedPathBounds.reset();
    this.lastAutoFitAt = null;
  }

  applyAutoFit() {
    const settings = this.getAutoFitSettings();
    const sequence = this.controller.sequence;
    if (!settings || !sequence || !this.currentSnapshot) return;
    const pathMode = this.getResampleMode();
    const revealedBounds = this.revealedPathBounds.update(sequence, this.currentSnapshot, { pathMode });
    let targetBounds = revealedBounds;
    if (this.controller.status === "playing" && settings.smoothingSeconds > 0) {
      const predictedElapsedMs = getPredictedSourceElapsedMs(
        this.currentSnapshot.sourceElapsedMs,
        sequence.sourceDurationMs,
        this.getMultiplier(),
        settings.smoothingSeconds,
      );
      const predictedSnapshot = samplePlaybackAt(sequence, predictedElapsedMs, { pathMode });
      targetBounds = this.predictedPathBounds.update(sequence, predictedSnapshot, { pathMode }) ?? revealedBounds;
    }
    const target = this.map.getFitView(targetBounds, settings.marginPx, settings.startingZoom);
    if (!target) return;

    const now = performance.now();
    const camera = this.lastAutoFitAt === null
      ? target
      : smoothCamera(this.map.getView(), target, now - this.lastAutoFitAt, settings.smoothingSeconds);
    this.lastAutoFitAt = now;
    this.map.setView([camera.lat, camera.lon], camera.zoom);
  }

  setError(message) {
    this.error = message;
    this.elements.error.textContent = message;
    this.elements.error.hidden = !message;
  }

  clearPreparation() {
    this.clearPrepareTimer();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.preparationId += 1;
  }

  clearPrepareTimer() {
    if (this.prepareTimer !== null) {
      window.clearTimeout(this.prepareTimer);
      this.prepareTimer = null;
    }
  }

  handleDialogKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }
}

function getElements() {
  return {
    modal: document.querySelector("#playbackModal"),
    restoreButton: document.querySelector("#restoreButton"),
    closeButton: document.querySelector("#closePlaybackButton"),
    rateModeInputs: Array.from(document.querySelectorAll('input[name="playbackRateMode"]')),
    multiplier: document.querySelector("#playbackMultiplier"),
    duration: document.querySelector("#playbackDuration"),
    durationUnit: document.querySelector("#playbackDurationUnit"),
    resampleValue: document.querySelector("#playbackResampleValue"),
    resampleUnitInputs: Array.from(document.querySelectorAll('input[name="playbackResampleUnit"]')),
    resampleModeInputs: Array.from(document.querySelectorAll('input[name="playbackResampleMode"]')),
    previewInputs: Array.from(document.querySelectorAll('input[name="playbackPreview"]')),
    autoFitInputs: Array.from(document.querySelectorAll('input[name="playbackAutoFit"]')),
    startingZoom: document.querySelector("#playbackStartingZoom"),
    pathMargin: document.querySelector("#playbackPathMargin"),
    smoothing: document.querySelector("#playbackSmoothing"),
    showInfo: document.querySelector("#playbackShowInfo"),
    error: document.querySelector("#playbackError"),
    status: document.querySelector("#playbackStatus"),
    playButton: document.querySelector("#playbackPlayButton"),
    pauseButton: document.querySelector("#playbackPauseButton"),
    resetButton: document.querySelector("#playbackResetButton"),
    info: document.querySelector("#playbackInfo"),
    distanceInfo: document.querySelector("#playbackDistanceInfo"),
    timeInfo: document.querySelector("#playbackTimeInfo"),
    regionInfo: document.querySelector("#playbackRegionInfo"),
  };
}

function getLayerDurationMs(layer) {
  if (layer?.status !== "ready" || layer.cleanedPoints?.length < 2) return 0;
  const first = Number(layer.cleanedPoints[0]?.[2]);
  const last = Number(layer.cleanedPoints.at(-1)?.[2]);
  return Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, last - first) : 0;
}

function getTotalSourceDurationMs(layers) {
  return (layers ?? []).reduce((sum, layer) => sum + getLayerDurationMs(layer), 0);
}

function formatInputNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (value >= 1000) return value.toFixed(2).replace(/\.00$/, "");
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export { PlaybackFeature };
