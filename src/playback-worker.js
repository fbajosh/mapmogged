import { buildPlaybackSequence } from "./playback-model.js";

self.addEventListener("message", (event) => {
  if (event.data?.type !== "build") return;
  const { id, layers, intervalMs } = event.data;

  try {
    const sequence = buildPlaybackSequence(layers, intervalMs);
    const transfer = sequence.segments.flatMap((segment) => [
      segment.samples.buffer,
      segment.sourceSamples.buffer,
    ]);
    self.postMessage({ type: "done", id, sequence }, transfer);
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      error: error instanceof Error ? error.message : String(error),
      code: error?.code ?? "PLAYBACK_BUILD_ERROR",
      minimumIntervalMs: error?.minimumIntervalMs ?? null,
    });
  }
});
