import { useCallback, useRef, useState } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-feature-table";
import "@arcgis/map-components/components/arcgis-expand";
import type { ArcgisMapCustomEvent } from "@arcgis/map-components";
import type { ArcgisFeatureTable } from "@arcgis/map-components/components/arcgis-feature-table";
import { Configuration, configure, configureSymbols } from "./configuration";
import { applySymbologyDraft, MAX_MARKER_SIZE, MIN_MARKER_SIZE, type SymbologyDraft } from "./symbology";

// This is a REST API - you can open this url on the browser to see the available fields in the layer
const FEATURE_LAYER_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0";

// SAMPLE CONFIG
const CONFIG: Configuration = {
  symbolConfig: {
    color: { field: "Leaf_Area", stops: [{value: 10, color: "#ffffff"}, {value: 40000, color: "#00fd00"}]},
    size: { field: "Leaf_Bmass", stops: [{value: 0, size: 5}, {value: 700, size: 40}]}
  },
  tableConfig: {
    columns: ["Leaf_Area", "Leaf_Bmass"]
  }
};

const INITIAL_DRAFT: SymbologyDraft = {
  lowColor: CONFIG.symbolConfig.color!.stops[0].color,
  highColor: CONFIG.symbolConfig.color!.stops[1].color,
  lowSize: String(CONFIG.symbolConfig.size!.stops[0].size),
  highSize: String(CONFIG.symbolConfig.size!.stops[1].size),
};

export default function App() {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const layerRef = useRef<FeatureLayer | null>(null);
  const initializedTable = useRef<ArcgisFeatureTable | null>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [appliedDraft, setAppliedDraft] = useState(INITIAL_DRAFT);
  const [hasApplied, setHasApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const changed = (Object.keys(draft) as (keyof SymbologyDraft)[])
    .some(key => draft[key] !== appliedDraft[key]);

  const handleTableRef = useCallback((table: ArcgisFeatureTable | null) => {
    if (!table || !layer) {
      setReady(false);
      return;
    }
    if (initializedTable.current !== table) {
      // Preview all dataset attributes before choosing the table settings UI.
      // Future: Use the user's selected column names and order here.
      configure(layer, table, {
        ...CONFIG,
        tableConfig: { columns: layer.fields.map(field => field.name) },
      });
      initializedTable.current = table;
    }
    setReady(true);
  }, [layer]);

  const edit = (field: keyof SymbologyDraft, value: string) => {
    setDraft(current => ({ ...current, [field]: value }));
    setError(null);
  };

  // Future: Save should persist a validated Configuration through the API;
  // keep Apply as a map-only operation so editing never overwrites a saved record.
  const apply = () => {
    if (!ready || !layer) return;
    const result = applySymbologyDraft(draft, appliedDraft, symbols => configureSymbols(layer, symbols));
    setError(result.error);
    if (!result.error) {
      setAppliedDraft(result.appliedDraft);
      setHasApplied(true);
    }
  };

  const handleReady = useCallback((event: ArcgisMapCustomEvent<void>) => {
    const view = event.target.view;
    if (!view?.map || layerRef.current) return;

    const layer = new FeatureLayer({
      url: FEATURE_LAYER_URL,
      outFields: ["*"],
      popupTemplate: {
        title: "{Cmn_Name} (Tree {Tree_ID})",
        content: [
          {
            type: "fields",
            fieldInfos: [
              { fieldName: "Sci_Name", label: "Scientific name" },
              { fieldName: "Status", label: "Status" },
              { fieldName: "Condition", label: "Condition" },
              { fieldName: "Height", label: "Height (ft)" },
              { fieldName: "Native", label: "Native" },
              { fieldName: "Land_Use", label: "Land use" },
            ],
          },
        ],
      },
    });

    layerRef.current = layer;
    view.map.add(layer);
    layer.when(
      () => {
        if (layer.fullExtent) view.goTo(layer.fullExtent).catch(() => {});
        setLayer(layer);
      },
      () => setLoadError("Could not load tree data. Check your connection and reload the page."),
    );
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      <form className="symbology-panel" noValidate onSubmit={event => { event.preventDefault(); apply(); }}>
        <fieldset>
          <legend>Point colour · Leaf area</legend>
          <label>At 10 <input type="color" value={draft.lowColor} onChange={event => edit("lowColor", event.target.value)} /></label>
          <label>At 40,000 <input type="color" value={draft.highColor} onChange={event => edit("highColor", event.target.value)} /></label>
        </fieldset>
        <fieldset>
          <legend>Point size · Leaf biomass</legend>
          <label>At 0 (pt) <input type="number" min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} step="any" value={draft.lowSize} onChange={event => edit("lowSize", event.target.value)} /></label>
          <label>At 700 (pt) <input type="number" min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} step="any" value={draft.highSize} onChange={event => edit("highSize", event.target.value)} /></label>
          <small>1–100 points; either direction allowed.</small>
        </fieldset>
        <div className="symbology-actions">
          <button type="submit" disabled={!ready}>Apply</button>
          <span role="status">{loadError ? "Map unavailable" : !ready ? "Loading map…" : changed ? "Changes not applied" : hasApplied ? "Applied — not saved" : "Default applied"}</span>
          {loadError && <span role="alert">{loadError}</span>}
          {error && <span role="alert">{error}</span>}
        </div>
      </form>
      <arcgis-map
        id="map"
        basemap="topo-vector"
        onarcgisViewReadyChange={handleReady}
        style={{ flex: 1, minHeight: 0 }}
      >
        <arcgis-expand slot="bottom-left" expanded>
          <arcgis-legend />
        </arcgis-expand>
      </arcgis-map>
      {layer && (
        <arcgis-feature-table
          ref={handleTableRef}
          referenceElement="map"
          layer={layer}
          style={{ height: "40vh" }}
        />
      )}
    </div>
  );
}
