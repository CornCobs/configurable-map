import { useCallback, useRef, useState } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-feature-table";
import "@arcgis/map-components/components/arcgis-expand";
import type { ArcgisMapCustomEvent } from "@arcgis/map-components";
import type { ArcgisFeatureTable } from "@arcgis/map-components/components/arcgis-feature-table";
import { Configuration, configure, configureSymbols, configureTable } from "./configuration";
import { applySymbologyDraft, MAX_MARKER_SIZE, MIN_MARKER_SIZE, type SymbologyDraft } from "./symbology";
import LeftRail from "./components/LeftRail";
import AttributeSettingsDrawer from "./components/AttributeSettingsDrawer";

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
  const [isAttributeDrawerOpen, setIsAttributeDrawerOpen] = useState(false);
  const [draftColumnNames, setDraftColumnNames] = useState<string[]>([]);
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const layerRef = useRef<FeatureLayer | null>(null);
  const initializedTable = useRef<ArcgisFeatureTable | null>(null);
  const [isTableInitialized, setIsTableInitialized] = useState(false);
  const [symbologyDraft, setSymbologyDraft] = useState(INITIAL_DRAFT);
  const [appliedSymbologyDraft, setAppliedSymbologyDraft] = useState(INITIAL_DRAFT);
  const [hasAppliedSymbology, setHasAppliedSymbology] = useState(false);
  const [symbologyError, setSymbologyError] = useState<string | null>(null);
  const [layerLoadError, setLayerLoadError] = useState<string | null>(null);
  const hasSymbologyChanges = (Object.keys(symbologyDraft) as (keyof SymbologyDraft)[])
    .some(key => symbologyDraft[key] !== appliedSymbologyDraft[key]);

  const handleTableRef = useCallback((table: ArcgisFeatureTable | null) => {
    if (!table || !layer) {
      setIsTableInitialized(false);
      return;
    }
    if (initializedTable.current !== table) {
      // Initially show all columns. Applying table settings later leaves map symbology unchanged.
      configure(layer, table, {
        ...CONFIG,
        tableConfig: { columns: layer.fields.map(field => field.name) },
      });
      initializedTable.current = table;
    }
    setIsTableInitialized(true);
  }, [layer]);

  const applyTableSettings = () => {
    if (!isTableInitialized || !layer || !initializedTable.current || draftColumnNames.length === 0) return;
    configureTable(layer, initializedTable.current, { columns: draftColumnNames });
    setIsAttributeDrawerOpen(false);
  };

  const updateSymbologyDraft = (field: keyof SymbologyDraft, value: string) => {
    setSymbologyDraft(current => ({ ...current, [field]: value }));
    setSymbologyError(null);
  };

  // Future: Save should persist a validated Configuration through the API;
  // keep Apply as a map-only operation so editing never overwrites a saved record.
  const applySymbology = () => {
    if (!isTableInitialized || !layer) return;
    const result = applySymbologyDraft(symbologyDraft, appliedSymbologyDraft, symbols => configureSymbols(layer, symbols));
    setSymbologyError(result.error);
    if (!result.error) {
      setAppliedSymbologyDraft(result.appliedDraft);
      setHasAppliedSymbology(true);
    }
  };

  const handleMapReady = useCallback((event: ArcgisMapCustomEvent<void>) => {
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
        setDraftColumnNames(layer.fields.map(field => field.name));
        setLayer(layer);
      },
      () => setLayerLoadError("Could not load tree data. Check your connection and reload the page."),
    );
  }, []);

  return (
    <div className="app-shell">
      <LeftRail
        isAttributeDrawerOpen={isAttributeDrawerOpen}
        onToggleAttributeDrawer={() => setIsAttributeDrawerOpen(selected => !selected)}
      />
      <AttributeSettingsDrawer
        isAttributeDrawerOpen={isAttributeDrawerOpen}
        fields={layer?.fields ?? []}
        columns={draftColumnNames}
        isTableInitialized={isTableInitialized}
        layerLoadError={layerLoadError}
        onChange={setDraftColumnNames}
        onApply={applyTableSettings}
      />
      <div className="map-workspace">
      <form className="symbology-panel" noValidate onSubmit={event => { event.preventDefault(); applySymbology(); }}>
        <fieldset>
          <legend>Point colour · Leaf area</legend>
          <label>At 10 <input type="color" value={symbologyDraft.lowColor} onChange={event => updateSymbologyDraft("lowColor", event.target.value)} /></label>
          <label>At 40,000 <input type="color" value={symbologyDraft.highColor} onChange={event => updateSymbologyDraft("highColor", event.target.value)} /></label>
        </fieldset>
        <fieldset>
          <legend>Point size · Leaf biomass</legend>
          <label>At 0 (pt) <input type="number" min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} step="any" value={symbologyDraft.lowSize} onChange={event => updateSymbologyDraft("lowSize", event.target.value)} /></label>
          <label>At 700 (pt) <input type="number" min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} step="any" value={symbologyDraft.highSize} onChange={event => updateSymbologyDraft("highSize", event.target.value)} /></label>
          <small>1–100 points; either direction allowed.</small>
        </fieldset>
        <div className="symbology-actions">
          <button type="submit" disabled={!isTableInitialized}>Apply</button>
          <span role="status">{layerLoadError ? "Map unavailable" : !isTableInitialized ? "Loading map…" : hasSymbologyChanges ? "Changes not applied" : hasAppliedSymbology ? "Applied — not saved" : "Default applied"}</span>
          {layerLoadError && <span role="alert">{layerLoadError}</span>}
          {symbologyError && <span role="alert">{symbologyError}</span>}
        </div>
      </form>
      <arcgis-map
        id="map"
        basemap="topo-vector"
        onarcgisViewReadyChange={handleMapReady}
        style={{ flex: 1, minHeight: 0 }}
      >
        {/* Keep the legend in workspace stacking rather than the browser's top layer. */}
        <arcgis-expand slot="bottom-left" expanded topLayerDisabled>
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
    </div>
  );
}
