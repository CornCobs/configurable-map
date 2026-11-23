import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Keep App, validation and configureSymbols real. Replace SDK objects and network lifecycle only.
const sdk = vi.hoisted(() => {
  const layers = [];
  class Value {
    constructor(properties = {}) { Object.assign(this, properties); }
  }
  class Layer extends Value {
    objectIdField = "OBJECTID";
    fields = ["Tree_ID", "Cmn_Name", "Leaf_Area", "Leaf_Bmass"].map(name => ({ name }));
    fullExtent = { xmin: 0, ymin: 0, xmax: 1, ymax: 1 };
    when = vi.fn((loaded, failed) => { this.loaded = loaded; this.failed = failed; });
    constructor(properties) { super(properties); layers.push(this); }
  }
  return { Value, Layer, layers };
});

vi.mock("@arcgis/core/layers/FeatureLayer", () => ({ default: sdk.Layer }));
vi.mock("@arcgis/core/core/Collection", () => ({ default: sdk.Value }));
vi.mock("@arcgis/core/renderers/UniqueValueRenderer", () => ({ default: sdk.Value }));
vi.mock("@arcgis/core/symbols/SimpleMarkerSymbol", () => ({ default: sdk.Value }));
vi.mock("@arcgis/core/widgets/FeatureTable/support/FieldColumnTemplate", () => ({ default: sdk.Value }));
vi.mock("@arcgis/core/widgets/FeatureTable/support/TableTemplate", () => ({ default: sdk.Value }));
vi.mock("@arcgis/map-components/components/arcgis-map", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-legend", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-feature-table", () => ({}));
vi.mock("@arcgis/map-components/components/arcgis-expand", () => ({}));

import App from "../src/App";

beforeEach(() => { sdk.layers.length = 0; });
afterEach(cleanup);

function mountApp() {
  const { container } = render(<StrictMode><App /></StrictMode>);
  const map = container.querySelector("arcgis-map");
  map.view = { map: { add: vi.fn() }, goTo: vi.fn().mockResolvedValue(undefined) };
  fireEvent(map, new Event("arcgisViewReadyChange"));
  return { container, map, layer: sdk.layers[0] };
}

function loadLayer(layer) { act(() => layer.loaded()); }
function sizeStops(layer) { return layer.renderer.visualVariables.find(variable => variable.type === "size").stops; }

test("real edits and Apply update the renderer; later edits preserve applied settings and table state", () => {
  const { container, map, layer } = mountApp();
  const apply = screen.getByRole("button", { name: "Apply" });
  expect(apply.disabled).toBe(true);
  loadLayer(layer);
  expect(apply.disabled).toBe(false);
  const initialRenderer = layer.renderer;
  const table = container.querySelector("arcgis-feature-table");
  const tableTemplate = table.tableTemplate;
  // Stand in for native table interactions made after startup.
  table.tableTemplate.columnTemplates.reverse();
  table.hiddenFields = ["Leaf_Area"];
  const hiddenFields = table.hiddenFields;

  fireEvent.change(screen.getByLabelText("At 10"), { target: { value: "#ff0000" } });
  fireEvent.change(screen.getByLabelText("At 40,000"), { target: { value: "#800080" } });
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "60" } });
  expect(screen.getByRole("status").textContent).toBe("Changes not applied");
  expect(layer.renderer).toBe(initialRenderer);
  fireEvent.click(apply);
  expect(layer.renderer).not.toBe(initialRenderer);
  expect(layer.renderer.visualVariables.find(variable => variable.type === "color").stops[0].color).toBe("#ff0000");
  expect(layer.renderer.visualVariables.find(variable => variable.type === "color").stops[1].color).toBe("#800080");
  expect(sizeStops(layer)[1].size).toBe(60);
  expect(screen.getByRole("status").textContent).toBe("Applied — not saved");

  const appliedRenderer = layer.renderer;
  fireEvent.change(screen.getByLabelText("At 0 (pt)"), { target: { value: "30" } });
  expect(layer.renderer).toBe(appliedRenderer);
  expect(table.tableTemplate).toBe(tableTemplate);
  expect(table.tableTemplate.columnTemplates.map(column => column.fieldName)).toEqual(["Leaf_Bmass", "Leaf_Area", "Cmn_Name", "Tree_ID"]);
  expect(table.hiddenFields).toBe(hiddenFields);
  fireEvent.click(apply);
  expect(sizeStops(layer).map(stop => stop.size)).toEqual([30, 60]);
  expect(table.tableTemplate).toBe(tableTemplate);
  expect(table.hiddenFields).toBe(hiddenFields);
  expect(map.view.goTo).toHaveBeenCalledTimes(1);
  fireEvent(map, new Event("arcgisViewReadyChange"));
  expect(sdk.layers).toHaveLength(1);
  expect(map.view.map.add).toHaveBeenCalledTimes(1);
});

test("invalid input keeps the last renderer and can be corrected through the actual form", () => {
  const { layer } = mountApp();
  loadLayer(layer);
  const input = screen.getByLabelText("At 700 (pt)");
  const apply = screen.getByRole("button", { name: "Apply" });
  fireEvent.change(input, { target: { value: "70" } });
  fireEvent.click(apply);
  expect(sizeStops(layer)[1].size).toBe(70);
  const appliedRenderer = layer.renderer;
  for (const invalid of ["", "101"]) {
    fireEvent.change(input, { target: { value: invalid } });
    fireEvent.click(apply);
    expect(screen.getByRole("alert").textContent).not.toBe("");
    expect(layer.renderer).toBe(appliedRenderer);
    expect(input.value).toBe(invalid);
  }
  fireEvent.change(input, { target: { value: "3" } });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(apply);
  expect(sizeStops(layer).map(stop => stop.size)).toEqual([5, 3]);
  expect(screen.queryByRole("alert")).toBeNull();
});

// Future: Test that drawer visibility/order edits leave the table unchanged until Apply.
// Future: Test chip-name hiding and grip reordering by drag and Alt + Left/Right.
// Future: Test that Apply updates columns and closes the drawer; rail close/reopen retains unapplied edits.
// Future: Test that an empty selection blocks Apply until a column is selected.
// Future: Test that docking preserves map/table state and pending edits.

test("failed tree loading shows an error and leaves Apply disabled", () => {
  const { layer } = mountApp();
  act(() => layer.failed(new Error("offline")));
  expect(screen.getByRole("alert").textContent).toContain("Could not load tree data");
  expect(screen.getByRole("button", { name: "Apply" }).disabled).toBe(true);
});
