# Configurable Trees

## Solution overview

A React map of the [Landscape Trees dataset](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0). Users edit point colour and size, then select **Apply**. Invalid edits show an error and leave the previous settings applied. Apply is disabled while tree data loads; load failures show an error.

The table starts with all dataset fields. Open **Settings** in the left rail to edit symbology and column chips. Click a selected name to hide it; search hidden columns and click to add. Drag a grip to reorder, or focus it and press Alt + Left/Right. **Apply settings** updates only the changed parts and keeps the drawer open; symbology-only edits preserve the table layout. Closing through the rail keeps unapplied drafts. At least one column must remain selected.

**Save as configuration** validates the current draft without requiring Apply, asks for a name, then saves and applies it. Select a saved configuration above the map to apply it; **View config** reloads the selected settings. Duplicate names (ignoring case and surrounding spaces) show an inline error. Save/open confirmations appear briefly at the top right; errors remain visible for correction.


## Architecture explanation

The React/TypeScript frontend is in `apps/web`. ArcGIS components display the map, legend and table using hosted tree data. `App.tsx` holds draft/applied state, `symbology.ts` validates symbols, and `configuration.ts` updates the renderer and table separately. Components under `src/components` provide the left rail and attribute drawer.

The Python/FastAPI backend stores combined configuration snapshots in SQLite at `apps/api/data/configurations.db`, created on startup and excluded from Git. Vite proxies `/api` requests to the backend. All browsers currently use one fixed demo owner; login is future work.

## Local setup instructions

Use Node.js 24 (tested with 24.16.0), pnpm and Python 3.11 (tested with 3.11.2). Run these one-time setup commands from the repository root in PowerShell.

**Frontend setup** — install the React app's dependencies:

```powershell
pnpm --dir apps/web install
```

**Backend setup** — create a Python environment and install the API/test dependencies:

```powershell
python -m venv apps/api/.venv
.\apps\api\.venv\Scripts\python.exe -m pip install -r apps/api/requirements-dev.txt
```

**Start the app** — run frontend and backend together from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

The combined command prints both URLs; Ctrl+C stops both servers. Frontend edits reload automatically; restart the combined command after Python edits. ArcGIS needs internet access.

From `apps/web`: `pnpm test` runs frontend tests; `pnpm run build` builds the app; `pnpm run preview` previews the build. From `apps/api`: `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` runs backend tests.

## API documentation or a link to it

Tree data comes from the [ArcGIS feature service](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0).

With the backend running, open [FastAPI docs](http://127.0.0.1:8000/api/docs). `POST /api/configurations` creates a named configuration; `GET /api/configurations` lists saved records; `GET /api/configurations/{id}` reopens one. Invalid payloads return `422`, duplicate names `409`, and missing/inaccessible records `404`.

`GET /api/configurations/default` returns the system's predefined configuration. The backend creates it in SQLite only if missing; restarts preserve existing settings. It uses the starter colours/sizes and shows `Leaf_Area`, then `Leaf_Bmass`. The frontend waits for this response before enabling settings; failures show a retry action rather than using a local fallback.

## Assumptions and trade-offs

- Local React state keeps the current draft/Apply workflow small.
- Colour uses Leaf_Area at 10/40,000; size uses Leaf_Bmass at 0/700. Fields and data ranges remain fixed.
- I chose a size range of 1–100 points for readability. Reversed size ramps are allowed.

## Known limitations

**Apply settings** updates the map and table without saving to the database. Saved configurations remain available after refreshing the page or restarting the backend; select one from the dropdown to load it again. Loading a default configuration from the backend at startup and sharing configurations are not implemented yet. The fields and data ranges used for point colour and size cannot be changed. The open settings drawer covers part of the map and table.

Browser checks confirmed that users can save edits without clicking Apply first, receive an error for duplicate names, and load saved configurations after refreshing. Automated App tests check that symbology and column changes apply independently, configurations can be saved and loaded, and errors preserve settings for retry. These tests simulate ArcGIS and do not check how the real map renders. Final manual acceptance, mobile layout and accessibility checks are still pending.

## Further improvements

Future: Dock the drawer so the map/table workspace narrows and the uncovered table remains horizontally scrollable. Adapt the layout for mobile and replace drawer icon glyphs with Font Awesome, Calcite icon set or an approved icon set while preserving accessible labels.

Future: Support metadata-driven field selection, editable data ranges and final UI polish. Complete required configuration and sharing workflows before optional extensions.

## AI usage disclosure

AI assisted with implementation, tests and documentation. Future: Attach a separate disclosure with contributions, decisions and verification.
