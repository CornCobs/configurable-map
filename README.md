# Configurable Trees

## Solution overview

A React map of the [Landscape Trees dataset](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0). Users edit point colour and size, then select **Apply**. Invalid edits show an error and leave the previous settings applied. Apply is disabled while tree data loads; load failures show an error.

The table starts with all dataset fields. Open **Table** in the left rail to edit compact column chips. Click a selected name to hide it; search hidden columns and click to add. Drag a grip to reorder, or focus it and press Alt + Left/Right. **Apply table settings** updates the table and closes the drawer. Closing through **Table** keeps the draft without applying it; at least one column must remain selected.

## Architecture explanation

The React/TypeScript frontend is in `apps/web`. ArcGIS components display the map, legend and table using hosted tree data. `App.tsx` holds draft/applied state, `symbology.ts` validates symbols, and `configuration.ts` updates the renderer and table separately. Components under `src/components` provide the left rail and attribute drawer.

Future: Add backend/storage details and the system architecture diagram when implemented.

## Local setup instructions

Use Node.js 24 (tested with 24.16.0) and pnpm. From the repository root:

```sh
cd apps/web
pnpm install
pnpm run dev
```

Open the URL printed by Vite. ArcGIS needs internet access.

From `apps/web`: `pnpm test` runs helper and App integration tests; `pnpm run build` builds the app; `pnpm run preview` previews the build.

## API documentation or a link to it

Tree data comes from the [ArcGIS feature service](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0).

Future: Link the application backend API documentation when implemented.

## Assumptions and trade-offs

- Local React state keeps the current draft/Apply workflow small.
- Colour uses Leaf_Area at 10/40,000; size uses Leaf_Bmass at 0/700. Fields and data ranges remain fixed.
- I chose a size range of 1–100 points for readability. Reversed size ramps are allowed.

## Known limitations

Apply does not save; reload restores the initial settings. Symbology field selection, saved custom configurations and sharing are not implemented. The desktop drawer overlays part of the workspace while open.

Not verified: live-map acceptance and responsive/accessibility checks.

## Further improvements

Future: Dock the drawer so the map/table workspace narrows and the uncovered table remains horizontally scrollable. Adapt the layout for mobile and replace drawer icon glyphs with Font Awesome or an approved icon set while preserving accessible labels.

Future: Support metadata-driven field selection, editable data ranges and final UI polish. Complete required configuration and sharing workflows before optional extensions.

## AI usage disclosure

AI assisted with implementation, tests and documentation. Future: Attach a separate disclosure with contributions, decisions and verification.
