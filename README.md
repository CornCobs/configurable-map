# Configurable Trees

To run the app from the repository root:

```sh
> cd apps/web
> pnpm install
> pnpm run dev
```

This is a simple web mapping application that visualizes the open Landscape Trees data available on ArcGIS Online's Living Atlas (https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0).

You can visit the link above to explore the feature service and its fields.

A function to configure the attribute table and visualization from a fixed data format has been provided in `apps/web/src/configuration.ts`, along with the schema. A sample usage is found in `apps/web/src/App.tsx`.

The map is rendered using the [ArcGIS Maps SDK for Javascript](https://developers.arcgis.com/javascript/latest/), using the `@arcgis/core` and `@arcgis/map-components` web components.

## Symbology validation

The symbology helper validates six-digit hex colours and finite marker sizes from 1–100 points, including reversed size ramps. Unit tests cover invalid input and preserving applied settings on failure. This step does not connect the helper to the App controls.

Run `npm test` from `apps/web` using Node.js 24.

Future: Connect the helper to colour/size controls and an Apply action.
