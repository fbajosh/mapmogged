# Timeline Map

Browser-only Google Timeline parser and map viewer.

## Local testing

Serve the static files from the repo root:

```sh
python3 -m http.server 5184
```

Then open `http://127.0.0.1:5184`.

The app reads JSON and CSV uploads through the browser `File` API. Processing happens in a Web Worker, and files are not uploaded anywhere.

## Current behavior

- Supports multiple uploaded layers at once.
- Extracts `semanticSegments[].timelinePath[]` from a Google Timeline JSON export.
- Parses manually created CSV files with `lat`, `long`, and `time` columns. Column order can vary, and CSV timestamps are treated as UTC.
- Parses `point` and `time` into latitude, longitude, UTC time, distance from the previous kept point, and speed in meters per second.
- Skips stationary drift below the configurable minimum speed.
- Skips implausible jumps above the configurable maximum speed.
- Keeps uploaded files as separate map layers in upload order.
- Allows each layer to use independent min speed, max speed, precision, color, size, and point/route settings.
- Renders either rounded unique point pins or a route path split at UTC year boundaries.
- Uses a local slippy-map renderer with OpenStreetMap tiles, so there is no external map JavaScript dependency.
- Uses fractional zoom for smoother wheel and button zooming.
- Centers the post-load map on an average sampled from the displayed filtered points.
- Keeps the cleaned point table internal instead of rendering it in the interface.
- Collapses the controls into a small map launcher and hides map zoom controls while collapsed.

All uploaded data is sorted by timestamp before speed filtering and rendering.
