# PlacePrint

Create print-ready city map posters from OpenStreetMap data with a multi-step Next.js app.

This project includes:
- A theme picker and guided UI flow (`/` -> `/details` -> `/generating` -> `/result`)
- Poster generation as `png`, `svg`, or `pdf`
- Theme-driven styling from `themes/*.json`
- Disk-backed cache and output storage for generated assets

## Example Thumbnails

These are generated preview thumbnails currently in `public/posters/templates/`.

| Theme | Example |
|---|---|
| Arctic Teal | ![Arctic Teal example](public/posters/templates/venice_arctic_teal_20260210_121148.png) |
| Autumn | ![Autumn example](public/posters/templates/vancouver_autumn_20260210_121150.png) |
| Blueprint | ![Blueprint example](public/posters/templates/new_york_blueprint_20260210_121151.png) |
| Contrast Zones | ![Contrast Zones example](public/posters/templates/istanbul_contrast_zones_20260210_121152.png) |
| Copper Patina | ![Copper Patina example](public/posters/templates/cairo_copper_patina_20260210_121154.png) |
| Desert Night | ![Desert Night example](public/posters/templates/dubai_desert_night_20260210_121157.png) |
| Emerald | ![Emerald example](public/posters/templates/stockholm_emerald_20260210_121159.png) |
| Forest | ![Forest example](public/posters/templates/cape_town_forest_20260210_121201.png) |
| Gradient Roads | ![Gradient Roads example](public/posters/templates/san_francisco_gradient_roads_20260210_121203.png) |
| Japanese Ink | ![Japanese Ink example](public/posters/templates/tokyo_japanese_ink_20260210_121204.png) |
| Midnight Blue | ![Midnight Blue example](public/posters/templates/sydney_midnight_blue_20260210_121206.png) |
| Monochrome Blue | ![Monochrome Blue example](public/posters/templates/chicago_monochrome_blue_20260210_121209.png) |
| Neon Cyberpunk | ![Neon Cyberpunk example](public/posters/templates/hong_kong_neon_cyberpunk_20260210_121211.png) |
| Noir | ![Noir example](public/posters/templates/london_noir_20260210_121213.png) |
| Ocean | ![Ocean example](public/posters/templates/amsterdam_ocean_20260210_121215.png) |
| Pastel Dream | ![Pastel Dream example](public/posters/templates/paris_pastel_dream_20260210_121218.png) |
| Sage Minimal | ![Sage Minimal example](public/posters/templates/singapore_sage_minimal_20260210_121219.png) |
| Sunset | ![Sunset example](public/posters/templates/rio_de_janeiro_sunset_20260210_121220.png) |
| Terracotta | ![Terracotta example](public/posters/templates/rome_terracotta_20260210_121222.png) |
| Warm Beige | ![Warm Beige example](public/posters/templates/barcelona_warm_beige_20260210_121355.png) |

## Quick Start

### Requirements

- Node.js 18+
- npm

### Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev       # start development server
npm run build     # build production bundle
npm run start     # run production server
npm run lint      # lint with Next.js ESLint config
npm run typecheck # TypeScript check (clears .next/types first)
```

## How Generation Works

1. Pick a theme (`/`)
2. Configure location and poster settings (`/details`)
3. Generate (`/generating`)
4. Download outputs (`/result`)

Location input supports either:
- `city` + `country`, or
- `latitude` + `longitude`

## API Reference

### `GET /api/themes`

Returns all theme definitions found in `themes/*.json`.

### `POST /api/posters`

Generates poster output(s).

Validation rules:
- Provide exactly one location mode: `city/country` or `latitude/longitude`
- `format` must be `png`, `svg`, or `pdf`

Common request fields:

| Field | Type | Required | Default / Notes |
|---|---|---|---|
| `city` | string | conditional | required with `country` |
| `country` | string | conditional | required with `city` |
| `latitude` | string | conditional | required with `longitude` |
| `longitude` | string | conditional | required with `latitude` |
| `theme` | string | no | `terracotta` |
| `allThemes` | boolean | no | `false` |
| `distance` | number | no | `18000` meters (min 100) |
| `width` | number | no | `12` inches (clamped `1..20`) |
| `height` | number | no | `16` inches (clamped `1..20`) |
| `format` | string | no | `png` |
| `showMarker` | boolean | no | `false` |
| `markerColor` | string | no | `#d62828` |
| `markerIcon` | string | no | `dot` (`none`, `dot`, `plus`, `star`) |
| `markerSize` | string | no | `medium` (`small`, `medium`, `large`) |
| `displayCity` | string | no | title override |
| `displayCountry` | string | no | subtitle override |
| `countryLabel` | string | no | fallback subtitle override |
| `fontFamily` | string | no | Google font family |

Example:

```bash
curl -X POST http://localhost:3000/api/posters \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Paris",
    "country": "France",
    "theme": "pastel_dream",
    "distance": 9000,
    "width": 12,
    "height": 16,
    "format": "png",
    "showMarker": true,
    "markerColor": "#d62828",
    "markerIcon": "dot",
    "markerSize": "medium"
  }'
```

### `GET /api/posters/file?path=posters/<relative-path>`

Streams a generated file from `POSTERS_DIR`.

### `GET /api/showcase`

Returns theme showcase metadata and preview URLs.

### `POST /api/showcase` (development only)

Generates missing preview thumbnails (or regenerates all) and updates `public/posters/showcase_manifest.json`.

Request body:

```json
{ "regenerate": false }
```

## Environment Variables

All variables are optional.

| Variable | Default | Purpose |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `POSTERS_DIR` | `posters` locally, `/tmp/posters` on serverless | Generated output directory |
| `CACHE_DIR` | `cache` locally, `/tmp/cache` on serverless | Request/cache directory |
| `NOMINATIM_SEARCH_URL` | `https://nominatim.openstreetmap.org/search` | Geocoder endpoint |
| `OVERPASS_API_URLS` | `https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter` | Comma-separated Overpass failover endpoints |
| `OVERPASS_API_URL` | none | Single endpoint fallback when `OVERPASS_API_URLS` is unset |
| `OVERPASS_MAX_RETRIES` | `3` local, `1` serverless | Retry attempts |
| `OVERPASS_RETRY_BASE_MS` | `800` local, `250` serverless | Exponential backoff base |
| `OVERPASS_QUERY_TIMEOUT_SECONDS` | `60` local, `25` serverless | Overpass timeout hint |
| `HTTP_TIMEOUT_MS` | `45000` local, `12000` serverless | General request timeout |
| `OVERPASS_REQUEST_TIMEOUT_MS` | `45000` local, `7500` serverless | Per-call Overpass timeout |
| `OVERPASS_TOTAL_TIMEOUT_MS` | `90000` local, `18000` serverless | Total Overpass timeout budget |
| `OSM_USER_AGENT` | `city_map_poster_js` | User-Agent for OSM requests |
| `GOOGLE_FONTS_USER_AGENT` | browser-like default | User-Agent for Google Fonts fetches |
| `SERVERLESS_MAX_COMPENSATED_DISTANCE_METERS` | `5000` | Serverless guardrail: max computed distance |
| `SERVERLESS_MAX_ROAD_FEATURES` | `14000` | Serverless guardrail: max kept road features |
| `SERVERLESS_MAX_ROAD_POINTS` | `28` | Serverless guardrail: points per road |
| `SERVERLESS_MAX_WATER_POLYGONS` | `650` | Serverless guardrail: max kept water polygons |
| `SERVERLESS_MAX_PARK_POLYGONS` | `900` | Serverless guardrail: max kept park polygons |
| `SERVERLESS_MAX_RING_POINTS` | `120` | Serverless guardrail: points per polygon ring |

Example `.env`:

```bash
LOG_LEVEL=debug
POSTERS_DIR=posters
CACHE_DIR=cache
NOMINATIM_SEARCH_URL=https://nominatim.openstreetmap.org/search
OVERPASS_API_URLS=https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter
OVERPASS_MAX_RETRIES=3
OVERPASS_RETRY_BASE_MS=800
OVERPASS_QUERY_TIMEOUT_SECONDS=60
HTTP_TIMEOUT_MS=45000
OVERPASS_REQUEST_TIMEOUT_MS=45000
OVERPASS_TOTAL_TIMEOUT_MS=90000
OSM_USER_AGENT=city_map_poster_js
```

## Theme Files

Themes live in `themes/`. Each file name (without `.json`) is the theme id.

Example (`themes/my_theme.json`):

```json
{
  "name": "My Theme",
  "description": "Custom palette",
  "bg": "#F5EDE4",
  "text": "#8B4513",
  "gradient_color": "#F5EDE4",
  "water": "#A8C4C4",
  "parks": "#E8E0D0",
  "road_motorway": "#A0522D",
  "road_primary": "#B8653A",
  "road_secondary": "#C9846A",
  "road_tertiary": "#D9A08A",
  "road_residential": "#E5C4B0",
  "road_default": "#D9A08A"
}
```

## Output Layout

```text
posters/                              # generated posters
public/posters/templates/             # showcase thumbnails
public/posters/showcase_manifest.json # preview manifest
cache/                                # API response/cache artifacts
fonts/cache/                          # downloaded Google font files
```

Generated file pattern:

```text
{city_slug}_{theme}_{YYYYMMDD_HHMMSS}.{png|svg|pdf}
```

## Troubleshooting

- Overpass timeout (`HTTP 504`): reduce `distance`, increase timeout env values, or set more stable Overpass endpoints.
- Validation failure from `/api/posters`: confirm exactly one location mode and a supported `format`.
- Missing showcase previews: in development, call `POST /api/showcase` to generate missing thumbnails.

## License

MIT. See `LICENSE`.
