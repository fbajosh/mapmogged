# Plan for Play

## Goal

Add a browser-only playback mode that animates the cleaned timeline layers in their current layer order, exposes rate and resampling controls in a playback dialog, optionally shows the unplayed path at 0% or 30% opacity, and can show progress and local region information over the map.

The implementation must preserve MapMogged's current privacy promise: playback and region lookup stay in the browser, with no coordinates sent to a reverse-geocoding service.

## Product decisions to build against

These decisions make the idea concrete enough to implement without stopping for design questions:

1. **Playback source:** use each ready layer's `cleanedPoints`, not `displayPoints`. Point-mode deduplication removes revisits and is not a valid timeline.
2. **Layer order:** append playable layers in the order shown in the Layers panel. A layer finishes before the next begins, even if their real dates overlap. Do not draw a connecting line or add connecting distance between layers.
3. **Playable layer:** a layer must be ready and contain at least two points with different timestamps. Disable the Play map button until all queued/processing work is finished and at least one playable layer exists.
4. **Source duration:** the total source duration is the sum of `(last timestamp - first timestamp)` for each playable layer. Gaps between separate layers do not count.
5. **Rate math:** `playback duration = source duration / multiplier`, and `multiplier = source duration / playback duration`. Resampling does not change either duration.
6. **Total-time input:** make Total time a numeric field with a Seconds / Minutes / Hours / Days unit selector. The inactive rate field and its unit selector are disabled but continue to show the derived value.
7. **Resampling:** create uniformly timed tracking positions within each layer at the selected interval, using time-based linear interpolation between cleaned points. Always keep the original first and last point, use the shortest longitude interpolation across the dateline, and never interpolate between layers. A `Path + tracking` / `Tracking only` switch chooses the geometry: the first mode uses the resampled positions for both line and marker, while the second maps the smoothed cumulative progress back onto the full cleaned-point polyline so the jagged route reveals smoothly and remains connected to the marker.
8. **Playback drawing:** temporarily render the temporal route regardless of whether the normal layer is configured as Points or Route. Draw completed travel at normal opacity, the current position as a clearly visible marker, and future travel at either 0 or 0.30 opacity. Use each layer's current color and width.
9. **Dialog behavior:** the playback dialog replaces the Layer panel at the same position and width without dimming or blocking the map. Pressing Play collapses the Play panel and bottom-left map controls, hides the top-left reveal control, waits 0.5 seconds, and then starts playback while leaving the information box visible. The information box or Escape restores the Play panel, and it restores automatically two seconds after playback finishes. The top-left reveal control remains visible for ordinary Layer-panel collapsing. Closing the visible Play panel pauses playback and restores the Layer panel and normal map layers.
10. **Information overlay:** show it while playback mode is visible, including when paused or reset. Hide it when the dialog is closed or the Show information option is off.
11. **Time display:** show the active source date converted to the browser's local timezone as `MMMM D`, followed by elapsed source-timeline time in parentheses, for example `June 2 (33 days)`. Do not show a time or timezone label. Elapsed time means elapsed source-timeline time across the appended sequence, not wall-clock playback time.
12. **Elapsed units:** interpret the repeated "minutes" in the idea as a typo. Use minutes below 60 minutes, hours below 24 hours, days below 365 days, and years at or above 365 days. Display the elapsed value as a whole number.
13. **Region row:** search every feature in the configured local GeoJSON set. When the current point matches a feature, show `[region name], [country name]`; when it matches none, hide the entire row. Do not hard-code a Spain/France/Portugal allowlist in lookup or display logic.
14. **Reset semantics:** Reset returns to the first point and keeps the current settings. Play from the finished state resets to the first point and starts again.
15. **Auto-fit camera:** an On / Off switch optionally fits the camera to all revealed positions. Starting zoom level is the maximum zoom used while the revealed path has no extent, Path margin is a pixel inset from each screen edge once the path grows, and Smoothing time is an exponential camera time constant in seconds. While playing, use the smoothing time as a wall-clock look-ahead horizon, converted to source time by the playback multiplier, so the target view anticipates camera lag without revealing the future route. A zero smoothing value applies the current target view immediately.

Suggested initial settings: Total time active at 60 seconds, resampling at 5 minutes, light preview, and information shown. These make both short and long uploads immediately watchable while still displaying the derived multiplier.

## Current code anchors

- `index.html` owns the existing instructions dialog and is the right place for the playback dialog and map-information overlay.
- `createMapControls()` in `src/main.js` builds the bottom-left Zoom and Layers controls. Append the `debug-line-by-line` playback button after the Layers control so `body.is-panel-collapsed .map-controls` hides it automatically.
- Each ready upload layer already retains time-sorted `cleanedPoints` shaped as `[lat, lon, timeMs, speedMps, distanceFromPreviousM, utcYear]`.
- `TimelineMap` owns the single overlay canvas. Playback should integrate through canvas layer objects with both `draw()` and `drawGlobe()` methods so flat and globe views behave the same way.
- The normal overlay render currently resizes and redraws everything. Playback needs an overlay-only render path so animation frames do not rebuild map tiles.

## Proposed modules and data

### `src/playback-model.js`

Keep all timeline calculations pure and Node-testable. It should expose functions equivalent to:

- `buildPlaybackSequence(layers, intervalMs)`
- `samplePlaybackAt(sequence, sourceElapsedMs)`
- `derivePlaybackDuration(sourceDurationMs, multiplier)`
- `deriveMultiplier(sourceDurationMs, playbackDurationMs)`
- `formatDistance(meters, speedUnitId)`
- `formatElapsed(sourceElapsedMs)`
- `formatLocalDate(timeMs)`

The sequence should contain a small summary plus ordered layer segments:

```js
{
  sourceDurationMs,
  totalDistanceM,
  segments: [{
    layerId,
    color,
    width,
    sequenceStartMs,
    durationMs,
    distanceStartM,
    sampleCount,
    samples // Float64Array with [lat, lon, localElapsedMs, localDistanceM] stride
  }]
}
```

Before resampling, remove duplicate timestamps within a layer deterministically by keeping the later coordinate. Calculate distance only within a layer. Use binary search to locate the active segment and sample; do not scan or slice the full sample list on every frame.

Guard against pathological sample counts. Define `MAX_PLAYBACK_SAMPLES` (start with 500,000 for all layers). Before building, calculate the requested count. If it exceeds the cap, keep the dialog open and show an inline error with the minimum interval that would fit; do not silently coarsen the user's setting.

### `src/playback-worker.js`

Run `buildPlaybackSequence()` off the UI thread. The controller sends snapshots of the ready layers plus the requested interval and a monotonically increasing preparation id. Return each segment's `Float64Array` buffer as a transferable so the generated sequence is not cloned back to the main thread. Ignore stale responses whose preparation id no longer matches, and terminate/recreate the worker when playback is invalidated.

### `src/playback-controller.js`

Own the state machine and clock, separate from DOM creation:

```text
idle -> preparing -> ready -> playing -> paused -> finished
                  \-> error
```

State includes rate mode, multiplier, total-time value/unit, resampling value/unit, preview alpha, show-information flag, source elapsed time, sequence revision, and animation-frame id.

Use `requestAnimationFrame` and `performance.now()`:

- Store accumulated wall time when pausing.
- On each playing frame, calculate source elapsed time from monotonic wall time and the multiplier.
- Clamp at total source duration and transition once to `finished`.
- Auto-pause on `document.visibilitychange` when the page becomes hidden so returning to the tab does not jump far ahead.
- Allow the clock and frame scheduler to be injected in tests.

Rate or total-duration edits while paused preserve the current source position. Resampling changes invalidate the built sequence and reset to the beginning. Preview and information toggles apply immediately.

### `src/playback-renderer.js`

Add a playback canvas layer that implements `draw(ctx, map)` and `drawGlobe(ctx, map, geometry)`.

For each frame:

1. Draw every future segment as a route at `previewAlpha`.
2. Draw completed segments and the completed part of the active segment at normal route opacity.
3. Draw an interpolated current-position marker on top in the active layer's color with a contrasting outline.
4. Never connect the end of one layer to the start of the next.

Use binary-searched end indexes rather than allocating partial arrays per frame. Preserve the existing viewport culling in both flat and globe projections.

Extend `TimelineMap` with an overlay-only scheduling method. It should resize the canvas only when its CSS dimensions or device-pixel ratio change, then redraw the canvas layers without calling `renderTiles()`.

### `src/region-lookup.js` and `gadm/manifest.json`

Use the checked-in, same-origin GeoJSON files and local point-in-polygon checks. The current set is:

- `gadm/gadm41_ESP_2.json` — 52 Spain ADM2 features; region name is `NAME_2`
- `gadm/gadm41_FRA_2.json` — 96 France ADM2 features; region name is `NAME_2`
- `gadm/gadm41_PRT_1.json` — 20 Portugal ADM1 features; region name is `NAME_1`

Add a small manifest with a `files` array. Runtime code loads every listed GeoJSON and treats all of their features as one searchable set. Adding a country later should require only adding its GeoJSON and one manifest entry.

Normalize each loaded feature into `{ id, countryName, regionName, geometry, bbox }`. For the GADM schema:

- Read the country from `COUNTRY`.
- Find the highest numbered non-empty `NAME_n` property for the region, rather than branching on country or administrative level.
- Use the corresponding `GID_n` as the stable feature id when available.
- Skip and report malformed features without preventing the other files from loading.

All three current files contain `MultiPolygon` geometry. The lookup must also support `Polygon` for future additions, including holes and islands. Precompute each feature's bounding box after load and reject by bounding box before ray casting.

Throttle regional lookup independently from animation and the numeric information overlay. Define `REGION_LOOKUP_INTERVAL_MS = 1000` and use `performance.now()` so point-in-polygon work runs at most once per real-time second while playback is active. Force one lookup at the final playback location even if the last regular lookup was less than one second earlier. Between checks, retain the last displayed region. At each allowed check, test the last matched feature first; only scan the full feature set if the point is no longer inside it.

Add miss hysteresis with `REGION_MISS_GRACE_COUNT = 3`. A successful match updates the label and resets `consecutiveRegionMisses` to zero. A no-match result or recoverable lookup error increments the counter: retain the old label after misses one and two, then clear it when the third consecutive one-second lookup fails. A later successful match restores the label and resets the counter. Paused playback performs no repeated lookup because its position is unchanged.

Add `gadm` to `deployEntries` in `scripts/build-static.mjs` so the existing files and manifest are copied into the static build. Lazy-load the manifest and geometry only when Show information is enabled. File-load and lookup errors follow the same three-miss label grace rule and must never stop playback.

Record the supplied dataset attribution/license in `THIRD_PARTY_NOTICES.md` and mention the local boundary lookup in the README privacy section. No runtime API or reverse-geocoding request is part of this design.

## Build phases

### Phase 1: Pure playback calculations

- Add `src/playback-model.js` and `test/playback-model.test.mjs`.
- Add `src/playback-worker.js`; keep the algorithm in the model module and use the worker only as its browser execution boundary.
- Implement playable-layer filtering, ordered concatenation, duration/rate math, fixed-interval resampling, transferable typed-array output, sample caps, cumulative distance, binary-search sampling, unit conversion, and formatting.
- Distance-unit mapping follows the selected speed unit: mph -> mi, km/h -> km, m/s -> m, knots -> NM. Use 1 mile = 1609.344 m and 1 NM = 1852 m, and display distance as a whole number.
- Keep this phase independent of DOM and canvas so edge cases are settled before UI work.

Acceptance:

- A one-day sequence at `1440x` derives `1 minute`.
- Switching to Total time and entering `30 seconds` derives `2880x`.
- Two overlapping layers play layer 1 then layer 2, and total distance excludes the jump between them.
- Resampling retains both endpoints and never creates a layer-to-layer segment.
- Elapsed formatting switches units exactly at 60 minutes, 24 hours, and 365 days.

### Phase 2: Playback clock and canvas rendering

- Add the controller state machine and deterministic clock tests.
- Connect the controller's preparing state to the playback worker, including stale-result and termination handling.
- Add playback canvas rendering for flat and globe modes.
- Add `TimelineMap`'s overlay-only render method and avoid canvas resizing on every animation frame.
- Swap normal canvas layers for playback layers while the dialog is active; restore normal layers when it closes.
- Add the current-position marker, completed path, and 0/0.30 future preview.
- Track dateline-aware revealed-path bounds incrementally and optionally animate the map camera toward a margin-aware target view.

Acceptance:

- Play, pause, resume, reset, finish, and replay produce deterministic source positions.
- Pausing does not accumulate hidden time; backgrounding the page auto-pauses.
- Map pan/zoom and flat/globe changes redraw the same playback position correctly.
- Tile images are not regenerated on every playback frame.

### Phase 3: Playback button and dialog

- Add the `debug-line-by-line`, `play`, `debug-pause`, and `debug-restart` paths to the existing `CODICON_PATHS` table, using the same local SVG approach as the current icons.
- Append the playback button under the Layers button in `createMapControls()`.
- Add the playback dialog markup to `index.html` and its responsive styles to `styles.css`, matching the Layer panel's 430 px footprint and translucent fill.
- Add the rate-mode switch, multiplier field, total-time field/unit, resampling value and Mins. / Hours / Days selector, None / Light preview switch, information switch, inline validation/status area, and Play/Pause/Reset icon buttons.
- Update derived fields on every valid input. Keep invalid input local to the dialog and disable Play until corrected.
- Implement dialog focus entry/return, visible focus styles, labels, and Escape behavior without trapping focus away from the still-interactive map controls. Announce preparation/errors/completion through a polite live region.

Acceptance:

- The playback button is disabled with a useful tooltip until playable data exists.
- The button appears below Layers and disappears with all map controls when the main panel is minimized.
- Exactly one rate input is enabled, and switching modes does not alter the represented playback duration.
- The layout remains usable at the existing 760 px mobile breakpoint.

### Phase 4: Information overlay and local regions

- Add a non-interactive DOM overlay near the top-right of `#map`, with enough inset to avoid map edges and mobile controls.
- Update numeric/date information at a throttled rate (for example 10 Hz) while keeping the canvas marker at animation-frame speed.
- Run regional point-in-polygon lookup on its separate one-second wall-clock throttle, retaining the previous region label between checks.
- Show:
  - `[distance covered] / [distance total] [distance unit]`
  - `[local datetime] / [elapsed value] [elapsed unit]`
  - `[region], [country]` only when the point matches any feature in the configured local GeoJSON set
- Add the manifest, generic GeoJSON loader/normalizer, lookup code, tests, notices, and attribution. Update the static build to include `gadm`.
- Cache region results so a polygon search is not repeated on every frame.

Acceptance:

- mph displays mi, km/h displays km, m/s displays m, and knots displays NM; all distance values use zero decimal places, and changing the existing speed-unit menu updates the overlay without resetting playback.
- Known fixture coordinates resolve to a Spanish province, French department, and Portuguese district/region.
- A point outside every loaded feature or a lookup failure counts as a miss; the region row clears on the third consecutive miss.
- Adding a fourth GADM-style GeoJSON plus a manifest entry works without a code change.
- During continuous playback, instrumented region lookup is invoked no more than once in any one-second wall-clock interval.
- One or two consecutive misses preserve the previous label, the third consecutive miss clears it, and the next match restores it.
- Browser network inspection shows no reverse-geocoding or other coordinate-bearing request.

### Phase 5: Lifecycle, documentation, and full verification

- On upload completion, add/delete/clear/reprocess, or a data-affecting layer setting change, pause and invalidate playback so it cannot hold stale arrays.
- Color and width changes may update the playback renderer in place; speed-unit changes only reformat distance.
- Terminate preparation work and cancel animation frames when playback is invalidated.
- Update the Instructions dialog and README with Play behavior, append ordering, local time display, resampling limits, and the privacy-safe local region lookup.
- Run `npm test` and `npm run build`.
- Browser-smoke test desktop and mobile layouts, keyboard-only operation, flat and globe views, multiple layers, long date ranges, and all four speed units.

## Test inventory

Add automated coverage for:

- rate/duration round trips and invalid/zero values
- seconds/minutes/hours/days conversion
- layer filtering, upload-order concatenation, and no cross-layer distance
- duplicate timestamps, dateline interpolation, first/last preservation, and sample-cap errors
- distance progress at segment boundaries and at finished state
- revealed-path bounds, dateline-aware fitting, path margins, starting-zoom caps, and camera smoothing
- local date formatting and all elapsed-unit boundaries
- speed-unit-to-distance-unit conversion
- controller transitions, pause/resume accounting, finish, replay, invalidation, and visibility auto-pause
- point-in-polygon behavior for polygons, holes, multipolygons, bbox rejection, and three known-region fixtures
- region-lookup throttling with an injected clock, including cached matches, transitions, pauses, three-miss hysteresis, recovery, and no-match clearing

Manual checks should include the exact 1 day / `1440x` / 1 minute and 30 seconds / `2880x` examples from the idea document.

## Definition of done

The feature is complete when a user can load one or more layers, open Play from the bottom-left map controls, configure either rate or total duration plus resampling, watch the layers animate sequentially in flat or globe view, pause/reset/replay reliably, choose no or light future-path preview, optionally see correct progress and locally matched region text, and do all of it without location coordinates leaving the browser.
