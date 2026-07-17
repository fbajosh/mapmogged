import test from "node:test";
import assert from "node:assert/strict";
import { PlaybackController } from "../src/playback-controller.js";

test("plays, pauses, resumes, and finishes with a monotonic clock", () => {
  const harness = makeHarness();
  const controller = new PlaybackController(harness.options);
  controller.setSequence(makeSequence(1000));
  assert.equal(controller.status, "ready");

  controller.play(2);
  harness.advance(100);
  assert.equal(controller.sourceElapsedMs, 200);
  controller.pause();
  harness.advanceWithoutFrame(100);
  assert.equal(controller.sourceElapsedMs, 200);

  controller.play();
  harness.advance(400);
  assert.equal(controller.sourceElapsedMs, 1000);
  assert.equal(controller.status, "finished");
});

test("reset and replay return to the beginning", () => {
  const harness = makeHarness();
  const controller = new PlaybackController(harness.options);
  controller.setSequence(makeSequence(100));
  controller.play(1);
  harness.advance(100);
  assert.equal(controller.status, "finished");
  controller.play();
  assert.equal(controller.sourceElapsedMs, 0);
  controller.pause();
  controller.reset();
  assert.equal(controller.status, "ready");
  assert.equal(controller.sourceElapsedMs, 0);
});

test("invalidation cancels a scheduled frame", () => {
  const harness = makeHarness();
  const controller = new PlaybackController(harness.options);
  controller.setSequence(makeSequence(1000));
  controller.play(1);
  assert.equal(harness.pendingCount(), 1);
  controller.invalidate();
  assert.equal(harness.pendingCount(), 0);
  assert.equal(controller.status, "idle");
});

function makeSequence(sourceDurationMs) {
  return { sourceDurationMs, segments: [{}] };
}

function makeHarness() {
  let time = 0;
  let nextId = 1;
  const callbacks = new Map();

  return {
    options: {
      now: () => time,
      requestFrame: (callback) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      },
      cancelFrame: (id) => callbacks.delete(id),
    },
    advance(milliseconds) {
      time += milliseconds;
      const pending = Array.from(callbacks.values());
      callbacks.clear();
      for (const callback of pending) callback(time);
    },
    advanceWithoutFrame(milliseconds) {
      time += milliseconds;
    },
    pendingCount: () => callbacks.size,
  };
}
