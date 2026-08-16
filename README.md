# TerraPulse

**Live Earth Event Monitor — an independent student project using NASA EONET open data.**

TerraPulse is a browser-based dashboard that turns NASA's Earth Observatory Natural Event Tracker (EONET) event metadata into:

- a live global map
- searchable and filterable event feed
- transparent High / Medium / Low prototype signal
- local watchlist
- basic event statistics
- graceful offline/demo fallback

## Why I built it

Natural events are often represented as separate data records. A student, teacher, researcher, or curious citizen should be able to open one page and quickly understand:

1. What kinds of events are currently listed?
2. Where are they?
3. Which ones should I inspect first?
4. Which events do I want to keep watching?

TerraPulse is an interface experiment for making open Earth-science data easier to explore.

## Data source

TerraPulse reads open event metadata from **NASA EONET**:

`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000`

NASA EONET is a continuously updated, curated source of natural-event metadata. TerraPulse is **not a NASA product and is not endorsed by NASA**.

## Tech stack

- HTML
- CSS
- Vanilla JavaScript
- NASA EONET API
- Leaflet
- OpenStreetMap tiles
- Browser localStorage

No backend or database is required.

## Features

### 1. Live data
On load, the app requests currently open EONET events.

### 2. Explainable priority heuristic
TerraPulse assigns a prototype signal using category names. For example, wildfires, severe storms, volcanoes, floods, earthquakes and landslides are treated as high-priority categories for easier triage.

This is **not a scientific hazard model**. It is deliberately simple and explainable.

### 3. Interactive map
Point events are plotted on a world map. Polygon events receive a simple centroid so the prototype can still visualize them.

### 4. Watchlist
Saved events are stored in the user's browser with localStorage. No account is required.

### 5. Offline fallback
If NASA's endpoint cannot be reached, a tiny clearly-labeled demo dataset keeps the interface testable.

## Run locally

No build step is required.

Option A: open `index.html` in a browser.

Option B: use a local server:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000`

A local server is recommended because browsers can apply stricter rules to local files.

## Deploy

This project can be deployed as a static site using GitHub Pages, Netlify, Vercel, or another static hosting service.

For Stardance, make sure your submitted demo URL is a real deployed project, not just your GitHub repository.

## Stardance submission checklist

- [ ] Public GitHub repository
- [ ] Frequent, meaningful commits made while actually developing
- [ ] Live deployed demo
- [ ] README explains the problem, design and data source
- [ ] At least one devlog describing real progress
- [ ] Hackatime/time tracking is set up if required by Stardance
- [ ] I understand the code and can explain it
- [ ] I disclose AI assistance honestly if I used it
- [ ] I have tested the project on mobile and desktop
- [ ] I do not claim NASA endorsement

## Suggested upgrades

If you want to make TerraPulse more technically ambitious, build these yourself after the base version works:

1. **Time slider** — replay events by date.
2. **Country/region filter** — reverse-geocode points locally or through a carefully chosen service.
3. **Trend chart** — count categories over the last 7/30 days.
4. **Event comparison** — compare two saved events.
5. **PWA/offline cache** — make the dashboard installable.
6. **Accessibility mode** — add a list-only view and keyboard map controls.
7. **Source panel** — show all source links for each event.
8. **Custom scoring model** — let users inspect exactly why a signal received its score.

## License

MIT — see `LICENSE`.

## Credits

- NASA EONET for Earth-event metadata
- Leaflet for the interactive map library
- OpenStreetMap contributors for map tiles

Built as an independent student project.
