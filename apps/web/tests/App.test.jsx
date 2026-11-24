import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  sdk.layers.length = 0;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mountApp() {
  const { container } = render(<StrictMode><App /></StrictMode>);
  const map = container.querySelector("arcgis-map");
  map.view = { map: { add: vi.fn() }, goTo: vi.fn().mockResolvedValue(undefined) };
  fireEvent(map, new Event("arcgisViewReadyChange"));
  fireEvent.click(screen.getByRole("button", { name: "Map settings" }));
  return { container, map, layer: sdk.layers[0] };
}

function loadLayer(layer) { act(() => layer.loaded()); }
function sizeStops(layer) { return layer.renderer.visualVariables.find(variable => variable.type === "size").stops; }

test("real edits and Apply update the renderer; later edits preserve applied settings and table state", () => {
  const { container, map, layer } = mountApp();
  const apply = screen.getByRole("button", { name: "Apply settings" });
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
  const apply = screen.getByRole("button", { name: "Apply settings" });
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
  fireEvent.click(apply);
  expect(sizeStops(layer).map(stop => stop.size)).toEqual([5, 3]);
  expect(screen.queryByRole("alert")).toBeNull();
});

// Future: Test native drag reordering, dialog focus and timed notification dismissal in a browser.
// Future: Test that docking preserves map/table state and pending edits.

function columnNames(table) { return table.tableTemplate.columnTemplates.map(column => column.fieldName); }
function response(body, status = 200) { return { ok: status < 400, status, json: async () => body }; }
function savedConfiguration(name = "My trees") {
  return {
    id: "saved-1", name, visibility: "private", created_at: "2026-11-24T00:00:00Z",
    configuration: {
      symbolConfig: {
        color: { field: "Leaf_Area", stops: [{ value: 10, color: "#ffffff" }, { value: 40000, color: "#00fd00" }] },
        size: { field: "Leaf_Bmass", stops: [{ value: 0, size: 5 }, { value: 700, size: 40 }] },
      },
      tableConfig: { columns: ["Tree_ID", "Cmn_Name", "Leaf_Area", "Leaf_Bmass"] },
    },
  };
}
async function openSave(name = "My trees") {
  await waitFor(() => expect(screen.getByRole("button", { name: "Save as configuration" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Save as configuration" }));
  fireEvent.change(screen.getByLabelText("Configuration name"), { target: { value: name } });
}

test("table drafts survive rail closing, reorder only on Apply, and preserve the renderer", () => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const table = container.querySelector("arcgis-feature-table");
  const renderer = layer.renderer;
  const template = table.tableTemplate;
  fireEvent.click(screen.getByRole("button", { name: "Hide Tree_ID" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Leaf_Area, position 2 of 3" }), { altKey: true, key: "ArrowLeft" });
  expect(table.tableTemplate).toBe(template);
  fireEvent.click(screen.getByRole("button", { name: "Map settings" }));
  expect(screen.queryByRole("heading", { name: "Visible columns (3)" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Map settings" }));
  const apply = screen.getByRole("button", { name: "Apply settings" });
  apply.focus();
  fireEvent.click(apply);
  expect(columnNames(table)).toEqual(["Leaf_Area", "Cmn_Name", "Leaf_Bmass"]);
  expect(layer.renderer).toBe(renderer);
  expect(document.activeElement).toBe(apply);
  expect(screen.getByRole("heading", { name: "Map settings" })).toBeTruthy();
  const appliedTemplate = table.tableTemplate;
  fireEvent.click(apply);
  expect(table.tableTemplate).toBe(appliedTemplate);
  expect(layer.renderer).toBe(renderer);
});

test("an empty column draft blocks Apply until a hidden column is selected", () => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const table = container.querySelector("arcgis-feature-table");
  const template = table.tableTemplate;
  for (const name of ["Tree_ID", "Cmn_Name", "Leaf_Area", "Leaf_Bmass"]) fireEvent.click(screen.getByRole("button", { name: `Hide ${name}` }));
  const apply = screen.getByRole("button", { name: "Apply settings" });
  expect(apply.disabled).toBe(true);
  expect(screen.getByRole("alert").textContent).toBe("Select at least one column.");
  expect(table.tableTemplate).toBe(template);
  fireEvent.click(screen.getByRole("button", { name: "Tree_ID", exact: true }));
  fireEvent.click(apply);
  expect(columnNames(table)).toEqual(["Tree_ID"]);
});

test("Save without Apply persists the draft and fully applies the successful snapshot", async () => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const table = container.querySelector("arcgis-feature-table");
  const renderer = layer.renderer;
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide Tree_ID" }));
  expect(sizeStops(layer)[1].size).toBe(40);
  await openSave();
  fetch.mockImplementationOnce(async (_url, options) => {
    const payload = JSON.parse(options.body);
    expect(payload.name).toBe("My trees");
    expect(payload.configuration.symbolConfig.size.stops[1].size).toBe(60);
    expect(payload.configuration.tableConfig.columns).not.toContain("Tree_ID");
    return response({ ...savedConfiguration(), configuration: payload.configuration });
  });
  fireEvent.click(screen.getByRole("button", { name: "Save configuration", exact: true }));
  await screen.findByText("Configuration “My trees” created successfully.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("My configuration").value).toBe("saved-1");
  expect(layer.renderer).not.toBe(renderer);
  expect(sizeStops(layer)[1].size).toBe(60);
  expect(columnNames(table)).toEqual(["Cmn_Name", "Leaf_Area", "Leaf_Bmass"]);
  fireEvent.click(screen.getByRole("button", { name: "Map settings" }));
  expect(screen.getAllByRole("status")[0].textContent).toBe("Saved configuration applied");
});

test.each([
  ["duplicate", () => Promise.resolve(response({ detail: "Choose a different name and try again." }, 409)), "Choose a different name"],
  ["network", () => Promise.reject(new TypeError("offline")), "Configuration service unavailable"],
])("a %s Save error retains the name, draft and applied settings", async (_kind, failure, message) => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const renderer = layer.renderer;
  const table = container.querySelector("arcgis-feature-table");
  const template = table.tableTemplate;
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "65" } });
  await openSave("Retry name");
  fetch.mockImplementationOnce(failure);
  fireEvent.click(screen.getByRole("button", { name: "Save configuration", exact: true }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(message));
  expect(screen.getByLabelText("Configuration name").value).toBe("Retry name");
  expect(layer.renderer).toBe(renderer);
  expect(table.tableTemplate).toBe(template);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("At 700 (pt)").value).toBe("65");
  expect(screen.getByRole("status").textContent).toBe("Changes not applied");
});

test("loading a saved snapshot fully reapplies it; cancelling discard preserves the draft", async () => {
  const saved = savedConfiguration();
  fetch.mockResolvedValue(response([saved]));
  const { container, layer } = mountApp();
  loadLayer(layer);
  const select = screen.getByLabelText("My configuration");
  await waitFor(() => expect(select.disabled).toBe(false));
  const table = container.querySelector("arcgis-feature-table");
  table.tableTemplate.columnTemplates.reverse();
  const renderer = layer.renderer;
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "65" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const requests = fetch.mock.calls.length;
  fireEvent.change(select, { target: { value: saved.id } });
  expect(confirm).toHaveBeenCalledOnce();
  expect(fetch.mock.calls.length).toBe(requests);
  expect(select.value).toBe("");
  expect(screen.getByLabelText("At 700 (pt)").value).toBe("65");
  confirm.mockReturnValue(true);
  fetch.mockResolvedValueOnce(response(saved));
  fireEvent.change(select, { target: { value: saved.id } });
  await screen.findByText("Configuration “My trees” loaded successfully.");
  expect(sizeStops(layer)[1].size).toBe(40);
  expect(layer.renderer).not.toBe(renderer);
  expect(columnNames(table)).toEqual(saved.configuration.tableConfig.columns);
  expect(screen.getByLabelText("At 700 (pt)").value).toBe("40");
  expect(select.value).toBe(saved.id);
  expect(screen.getAllByRole("status")[0].textContent).toBe("Saved configuration applied");
});

function failNextTableConfiguration(table) {
  let hiddenFields = table.hiddenFields;
  let fail = true;
  Object.defineProperty(table, "hiddenFields", {
    configurable: true,
    get: () => hiddenFields,
    set(value) { if (fail) { fail = false; throw new Error("SDK failed"); } hiddenFields = value; },
  });
}

test("a table apply failure rolls back both parts and leaves the draft retryable", () => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const table = container.querySelector("arcgis-feature-table");
  const previous = { renderer: layer.renderer, template: table.tableTemplate, hidden: table.hiddenFields };
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "75" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide Tree_ID" }));
  failNextTableConfiguration(table);
  fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
  expect(screen.getByRole("alert").textContent).toContain("Could not apply settings");
  expect(layer.renderer).toBe(previous.renderer);
  expect(table.tableTemplate).toBe(previous.template);
  expect(table.hiddenFields).toBe(previous.hidden);
  expect(screen.getByRole("status").textContent).toBe("Changes not applied");
  fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
  expect(sizeStops(layer)[1].size).toBe(75);
  expect(columnNames(table)).not.toContain("Tree_ID");
});

test("a rendering failure after Save reports persistence success and keeps the draft for Apply", async () => {
  const { container, layer } = mountApp();
  loadLayer(layer);
  const table = container.querySelector("arcgis-feature-table");
  const renderer = layer.renderer;
  fireEvent.change(screen.getByLabelText("At 700 (pt)"), { target: { value: "80" } });
  await openSave();
  fetch.mockImplementationOnce(async (_url, options) => response({ ...savedConfiguration(), configuration: JSON.parse(options.body).configuration }));
  failNextTableConfiguration(table);
  fireEvent.click(screen.getByRole("button", { name: "Save configuration", exact: true }));
  await screen.findByText("Configuration “My trees” created successfully.");
  expect(screen.getByRole("alert").textContent).toContain("Configuration saved, but could not apply it");
  expect(layer.renderer).toBe(renderer);
  expect(screen.getByLabelText("My configuration").value).toBe("saved-1");
  expect(screen.getByLabelText("At 700 (pt)").value).toBe("80");
  fireEvent.click(screen.getByRole("button", { name: "Apply settings" }));
  expect(sizeStops(layer)[1].size).toBe(80);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("failed tree loading shows an error and leaves Apply disabled", () => {
  const { layer } = mountApp();
  act(() => layer.failed(new Error("offline")));
  expect(screen.getAllByRole("alert")[0].textContent).toContain("Could not load tree data");
  expect(screen.getByRole("button", { name: "Apply settings" }).disabled).toBe(true);
});
