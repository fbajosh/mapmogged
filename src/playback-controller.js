class PlaybackController {
  constructor(options = {}) {
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
    this.onFrame = options.onFrame ?? (() => {});
    this.onStateChange = options.onStateChange ?? (() => {});
    this.status = "idle";
    this.sequence = null;
    this.multiplier = 1;
    this.sourceElapsedMs = 0;
    this.startedAt = null;
    this.frameId = null;
  }

  setPreparing() {
    this.stopFrame();
    this.status = "preparing";
    this.sequence = null;
    this.sourceElapsedMs = 0;
    this.startedAt = null;
    this.emitState();
  }

  setSequence(sequence) {
    this.stopFrame();
    this.sequence = sequence;
    this.sourceElapsedMs = 0;
    this.startedAt = null;
    this.status = sequence?.segments?.length ? "ready" : "idle";
    this.emitFrame();
    this.emitState();
  }

  setError() {
    this.stopFrame();
    this.status = "error";
    this.startedAt = null;
    this.emitState();
  }

  setMultiplier(multiplier) {
    const value = Number(multiplier);
    if (!Number.isFinite(value) || value <= 0) return false;
    if (this.status === "playing") this.updatePosition(this.now());
    this.multiplier = value;
    if (this.status === "playing") this.startedAt = this.now();
    return true;
  }

  play(multiplier = this.multiplier) {
    if (!this.sequence?.segments?.length || !this.setMultiplier(multiplier)) return false;
    if (this.status === "finished") this.sourceElapsedMs = 0;
    if (this.status === "playing") return true;

    this.status = "playing";
    this.startedAt = this.now();
    this.emitState();
    this.scheduleFrame();
    return true;
  }

  pause() {
    if (this.status !== "playing") return false;
    this.updatePosition(this.now());
    this.stopFrame();
    this.startedAt = null;
    this.status = this.sourceElapsedMs >= this.sequence.sourceDurationMs ? "finished" : "paused";
    this.emitFrame();
    this.emitState();
    return true;
  }

  reset() {
    this.stopFrame();
    this.startedAt = null;
    this.sourceElapsedMs = 0;
    this.status = this.sequence?.segments?.length ? "ready" : "idle";
    this.emitFrame();
    this.emitState();
  }

  invalidate() {
    this.stopFrame();
    this.startedAt = null;
    this.sourceElapsedMs = 0;
    this.sequence = null;
    this.status = "idle";
    this.emitState();
  }

  destroy() {
    this.stopFrame();
    this.sequence = null;
  }

  scheduleFrame() {
    this.stopFrame();
    this.frameId = this.requestFrame((timestamp) => this.tick(timestamp));
  }

  tick(timestamp) {
    this.frameId = null;
    if (this.status !== "playing") return;
    this.updatePosition(Number.isFinite(timestamp) ? timestamp : this.now());
    this.emitFrame();

    if (this.sourceElapsedMs >= this.sequence.sourceDurationMs) {
      this.status = "finished";
      this.startedAt = null;
      this.emitState();
      return;
    }

    this.scheduleFrame();
  }

  updatePosition(now) {
    if (this.startedAt === null || !this.sequence) return;
    const wallElapsedMs = Math.max(0, now - this.startedAt);
    this.sourceElapsedMs = Math.min(
      this.sequence.sourceDurationMs,
      this.sourceElapsedMs + wallElapsedMs * this.multiplier,
    );
    this.startedAt = now;
  }

  stopFrame() {
    if (this.frameId === null) return;
    this.cancelFrame(this.frameId);
    this.frameId = null;
  }

  emitFrame() {
    this.onFrame(this.sourceElapsedMs, this.status);
  }

  emitState() {
    this.onStateChange(this.status);
  }
}

export { PlaybackController };
