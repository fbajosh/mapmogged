import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackFeature } from "../src/playback-feature.js";

test("collapses and restores playback controls without closing playback mode", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const classes = makeClassList();
  globalThis.document = { body: { classList: classes } };
  globalThis.window = { clearTimeout() {} };

  try {
    const attributes = new Map();
    let focused = "";
    const feature = Object.assign(Object.create(PlaybackFeature.prototype), {
      isOpen: true,
      isPanelHidden: false,
      panelRevealTimer: null,
      controller: { status: "playing" },
      elements: {
        restoreButton: { focus: () => { focused = "restore"; } },
        pauseButton: { focus: () => { focused = "pause"; } },
        closeButton: { focus: () => { focused = "close"; } },
        info: {
          hidden: false,
          focus: () => { focused = "info"; },
          setAttribute: (name, value) => attributes.set(name, value),
          removeAttribute: (name) => attributes.delete(name),
        },
      },
    });

    feature.hidePanel();
    assert.equal(feature.isPanelHidden, true);
    assert.equal(classes.contains("is-playback-panel-hidden"), true);
    assert.equal(attributes.get("role"), "button");
    assert.equal(focused, "info");

    feature.showPanel();
    assert.equal(feature.isPanelHidden, false);
    assert.equal(classes.contains("is-playback-panel-hidden"), false);
    assert.equal(attributes.has("role"), false);
    assert.equal(focused, "pause");
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("window", originalWindow);
  }
});

test("waits 500 ms after hiding controls before starting playback", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let callback = null;
  let delay = null;
  globalThis.document = { hidden: false };
  globalThis.window = {
    setTimeout(nextCallback, nextDelay) {
      callback = nextCallback;
      delay = nextDelay;
      return 17;
    },
    clearTimeout() {},
  };

  try {
    let hidden = false;
    let playedAt = null;
    const feature = Object.assign(Object.create(PlaybackFeature.prototype), {
      isOpen: true,
      pendingPlayTimer: null,
      panelRevealTimer: null,
      controller: {
        sequence: { segments: [{}] },
        status: "ready",
        play: (multiplier) => { playedAt = multiplier; },
      },
      getMultiplier: () => 3,
      getAutoFitError: () => "",
      setError() {},
      hidePanel: () => { hidden = true; },
      syncUi() {},
    });

    feature.play();
    assert.equal(hidden, true);
    assert.equal(delay, 500);
    assert.equal(playedAt, null);
    callback();
    assert.equal(playedAt, 3);
    assert.equal(feature.pendingPlayTimer, null);
  } finally {
    restoreGlobal("document", originalDocument);
    restoreGlobal("window", originalWindow);
  }
});

test("reveals playback controls two seconds after playback finishes", () => {
  const originalWindow = globalThis.window;
  let callback = null;
  let delay = null;
  globalThis.window = {
    setTimeout(nextCallback, nextDelay) {
      callback = nextCallback;
      delay = nextDelay;
      return 23;
    },
    clearTimeout() {},
  };

  try {
    let shown = false;
    const feature = Object.assign(Object.create(PlaybackFeature.prototype), {
      panelRevealTimer: null,
      showPanel: () => { shown = true; },
    });
    feature.schedulePanelReveal();
    assert.equal(delay, 2000);
    assert.equal(shown, false);
    callback();
    assert.equal(shown, true);
  } finally {
    restoreGlobal("window", originalWindow);
  }
});

function makeClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    contains: (name) => classes.has(name),
  };
}

function restoreGlobal(name, value) {
  if (value === undefined) delete globalThis[name];
  else globalThis[name] = value;
}
