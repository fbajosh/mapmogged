for the map, i want to be able to "play" the timeline. let's do the following:

Add a button under the layers button with a debug-line-by-line icon from VS Code. This button hides along with the other buttons when the menu is minimized

Clicking that button will open a modal. some components include:
- two boxes and a switch between them
 -- first box is a real time multipllier
 -- the second box is a total time
 -- based on the switch between them, the other disabled but updated to show the math from the other entry. so if a path is 1 day beginning to end, 1440x will be 1 minute. entering 1440 will display 1 minute on the other box, then switching it and entering saying 30 seconds will show 2880x
 -- if there are multiple layers, append them in order. so layer 1 then layer 2, etc.
- a number entry and a toggle between minutes, hours, or days (so could be 5 minutes / 2 days / 4 hours / etc) that is the smoothing / resampling of the timestamps
- another switch for no path preview (0% opacity) or light preview (30% opacity)
- play, pause, and reset buttons (VS Code icons play, debug-pause, debug-restart)
- toggle for showing information on the map - see section below for what this means

information to show on the map:
- towards the top right of the screen, display some text overlaying the map with the following:
 -- [distance_covered] / [distance_total] [distance_unit]
 -- [displayed_datetime] / [elapsed_time] [time_unit]
 -- [region_name], [country_name]
- distance unit is the selected metrics from the other modal (mph = miles, km/h = km, m/s = m, knots = NM)
- elapsed_time time unit shows in minutes, then hours, days, then years based on the value (< 60 minutes as minutes, < 24 hours as minutes, <365 days as days, after that it's 0.0 years)
- have this text be the same size and font as the other modal text for now
- the slash is kept, as it shows progress in two forms
- for region name, use the lat long to determine the region. In Spain, use the province. In France use the department. In Portugal, use the district. for other countries, do not show this row. 