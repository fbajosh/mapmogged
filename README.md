# MapMogged

MapMogged is a browser-only map viewer for Google Maps Timeline exports and manual timeline CSV files. The hosted app is available at [https://appmogged.com/mapmogged](https://appmogged.com/mapmogged).

It turns location history files into cleaned point or route layers that can be explored on a flat map or globe view.

## Privacy

All timeline processing is done in your browser. When you choose a file, the page reads it through the browser File API and sends it to a Web Worker running locally in the same browser session. The uploaded file, parsed points, cleaned points, timestamps, and layer settings are not uploaded, posted, logged, or communicated back to the AppMogged server.

From that server-data perspective, the app is private and secure: the server only sends static site files to your browser, and your timeline data stays on your computer.

Flat map modes can request public basemap tiles from OpenStreetMap or CARTO as you pan and zoom. Those requests are normal map tile requests and do not include your uploaded file contents or the parsed point table. The blank map and globe basemap avoid third-party tile basemap requests.

## Getting Your Google Timeline JSON

Google documents the Timeline export flow here: [Google Maps Timeline export instructions](https://support.google.com/maps/answer/6258979).

MapMogged expects the Google Timeline JSON export format that contains `semanticSegments[].timelinePath[]` entries. You do not need to edit the Google JSON file before uploading it.

## Supported Files

- Google Timeline JSON: the app scans the export for `timelinePath` arrays and reads each path object with a `point` and `time` value.
- Manual CSV: the file must have columns named `lat`, `long`, and `time`. Column order can vary. Latitude and longitude should be decimal degrees. Times are treated as UTC; timestamps with `Z` or an explicit offset are also accepted.
- Multiple files: each upload becomes its own map layer. Layers are displayed in upload order, with the first upload underneath later uploads.

## How Parsing Works

The parser is designed for large Timeline exports. Instead of calling `JSON.parse` on the entire file, the app reads the file as a stream, decodes it in chunks, scans for `timelinePath` arrays, and parses individual path objects as they are found. CSV files are also read incrementally and parsed line by line, including quoted CSV values.

Parsing runs in a Web Worker so the main page can keep updating progress and map controls while the file is being processed. After parsing, the app normalizes each point into latitude, longitude, and UTC timestamp. Invalid coordinates, invalid timestamps, and non-forward time steps are skipped. All valid raw points are then sorted by timestamp before filtering.

Large-file note: the app avoids loading the full JSON text into one giant object, but it still keeps normalized points in browser memory so it can sort and render them. Browser RAM still matters for very large files.

## Layer Filtering

MapMogged computes distance with the Haversine formula and converts each movement into meters per second.

Every processed layer reports the minimum and maximum valid source timestamps. The Range controls begin at those bounds and can crop processing to an inclusive subrange; the browser prevents either endpoint from leaving the available dataset range or crossing the other endpoint. Exclusions remove points in one or more inclusive blackout intervals. Both controls use the browser's local datetime at minute precision and automatically reprocess the layer when a valid date edit is committed or an exclusion is added or removed.

The first valid point is kept. For each later raw point, the app compares it to the previous raw point:

- If elapsed time is zero or negative, the point is skipped as invalid.
- If speed is below the minimum speed threshold, the point is treated as stationary GPS drift and skipped.
- If speed is above the maximum speed threshold, the point is treated as an implausible GPS jump or spoofing artifact and skipped.
- If speed is inside the allowed range, the point is kept.

The default minimum speed is `0.44704 m/s`, the default maximum speed is `447.04 m/s`, and both are adjustable per layer. The visible speed unit defaults to mph and can be changed from the ruler menu. Skipped points still advance the raw comparison state, so the app can resume keeping points once movement returns to the allowed speed range.

Each kept point stores latitude, longitude, UTC time, speed in meters per second, distance from the previous kept point, and UTC year. Route rendering breaks the line at UTC year boundaries.

## Point And Route Layers

Each layer can be rendered as points or as a route:

- Point mode rounds each cleaned latitude and longitude to the selected precision. The default precision is `4`, meaning `10^-4` degrees. Duplicate rounded coordinates are drawn once, which greatly reduces dense stationary clusters.
- Route mode draws through the cleaned points using three distance-aware primitives: edges shorter than `0.1°` stay straight, edges from `0.1°` through `1°` use tension-limited cubic Bézier smoothing, and edges longer than `1°` follow subdivided great-circle arcs. The same geometry is used on the flat map, globe, and during playback. Normal route layers start a new path at each UTC year boundary, which keeps very long timelines easier to draw and inspect.

Each layer has its own mode, color, weight, precision, minimum speed, maximum speed, range, and exclusions. The custom color picker can use one solid color or a two-color gradient mapped across that layer's timestamps: earlier points use the first color, later points use the second, and the intervening track is interpolated between them. The same gradient follows the route and marker during playback. Those controls share a four-tab settings area: Visual (the default), Mechanics, Range, and Exclusions. Range and Exclusions apply automatically; use the layer's refresh button after changing a Mechanics speed filter. Reprocessing a layer reruns the parser and cleaner with that layer-specific configuration; changing point precision, color, weight, or route mode updates the rendered layer without merging it into other uploads.

## Map Rendering

The map is drawn with browser-native code and canvas overlays. Flat map mode can use OpenStreetMap, CARTO light, CARTO dark, or a blank background. Globe mode uses a local SVG basemap projected onto an orthographic globe. Uploaded point and route layers are drawn over the selected basemap.

For performance, the renderer only draws visible points and visible route segments for the current view. Points or line segments behind the globe or outside the viewport are skipped during rendering.

## Timeline Playback

After every uploaded layer finishes processing, the play control below Map settings opens timeline playback. Ready layers are appended in their displayed order; each layer completes before the next starts, even when their source dates overlap. Playback uses cleaned timestamped points rather than point-mode display deduplication, and it never draws or measures a connecting jump between separate layers.

Playback can be configured by real-time multiplier or total playback duration. Those fields update each other using `playback duration = source duration / multiplier`. Timestamp resampling always smooths tracking progress. `Path + tracking` applies that progress to the simplified route geometry. `Tracking only` projects the same smooth progress onto the full cleaned-point route. In either mode, the distance-aware straight, Bézier, and great-circle geometry is shared by the revealed line, marker, and auto-zoom bounds so they remain connected on every frame. The playback node can remain a circle or use a filled Send arrow that rotates with the projected route direction, and its Size control sets the rendered diameter in pixels. The future path can be hidden, shown as a light preview, shown at the same opacity as the revealed path, or drawn with a custom color and opacity. Play, Pause, and Reset operate on the prepared sequence in both flat and globe views. Starting playback collapses the Play panel and map controls, hides the normal top-left reveal control, then begins after a 0.5-second transition delay. The information box or Escape restores the Play panel, and it returns automatically two seconds after playback finishes. The top-left reveal control remains available for ordinary Layer-panel collapsing.

Optional auto-zoom follows the revealed path as it grows. Starting zoom caps the initial close-up, Path margin sets the minimum screen-edge spacing in pixels, and Smoothing time controls a frame-rate-independent camera easing function in seconds. To compensate for easing lag, camera fitting looks ahead by the smoothing time multiplied by the playback rate while still drawing only the currently revealed route. A smoothing value of zero follows the calculated view immediately.

The optional map information overlay shows covered and total distance in the distance unit associated with the selected speed unit (`miles`, `km`, `meters`, or `NM`), the active date in the browser's local timezone with source elapsed time, and a region/country label when the point matches a configured local boundary. Its final row shows elapsed and total real playback time as `m:ss / m:ss`, followed by the playback multiplier formatted to two significant figures.

## Local Region Lookup

Regional names are resolved entirely in the browser. `gadm/manifest.json` lists the local GeoJSON files that form the searchable region set. The loader uses the most specific available GADM `NAME_n` property, so administrative levels can differ between files and another GADM-style country file can be added with a manifest entry rather than a code change.

Point-in-polygon lookup runs at most once per real-time second. The previous region label is retained for two consecutive misses and cleared on the third; a later match restores it. No reverse-geocoding service receives playback coordinates.

See `THIRD_PARTY_NOTICES.md` for the boundary-data terms that must be reviewed before redistribution or deployment.
