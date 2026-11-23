import { useRef, useState } from "react";
import './styles.css';

type AttributeSettingsDrawerProps = {
  isAttributeDrawerOpen: boolean;
  fields: { name: string }[];
  columns: string[];
  isTableInitialized: boolean;
  layerLoadError: string | null;
  onChange: (columns: string[]) => void;
  onApply: () => void;
};

export default function AttributeSettingsDrawer({ isAttributeDrawerOpen, fields, columns, isTableInitialized, layerLoadError, onChange, onApply }: AttributeSettingsDrawerProps) {
  const [search, setSearch] = useState("");
  const draggedField = useRef<string | null>(null);
  if (!isAttributeDrawerOpen) return null;

  const hiddenFields = fields.filter(field => !columns.includes(field.name));
  const matchingFields = hiddenFields.filter(field => field.name.toLowerCase().includes(search.trim().toLowerCase()));
  const move = (fieldName: string, to: number) => {
    const from = columns.indexOf(fieldName);
    if (from < 0 || to < 0 || to >= columns.length || from === to) return;
    const reordered = [...columns];
    reordered.splice(from, 1);
    reordered.splice(to, 0, fieldName);
    onChange(reordered);
  };

  // Future: Dock this drawer by shrinking the map/table workspace so the table stays uncovered and horizontally scrollable.
  // Future: Adapt the drawer and its controls for mobile screens.
  // Future: Replace all drawer icon glyphs (drag, add and remove) with Font Awesome or an approved icon set; preserve accessible labels.
  return (
    <aside className="attribute-drawer" aria-labelledby="attribute-settings-heading">
      <header>
        <h2 id="attribute-settings-heading">Attribute display settings</h2>
        <p>Apply to update the table. Closing keeps your draft.</p>
      </header>
      <div className="attribute-drawer-body">
        <div className="attribute-drawer-content">
          {layerLoadError ? <p role="alert">{layerLoadError}</p> : !isTableInitialized ? <p>Loading table fields…</p> : <>
            <h3>Visible columns ({columns.length})</h3>
            <p id="attribute-order-hint">Order runs left to right, then the next row. Click a name to hide. Drag a grip to reorder, or focus it and use Alt + ← / →.</p>
            <ol className="attribute-columns" aria-label="Visible columns in display order">
              {columns.map((fieldName, index) => (
                <li key={fieldName} onDragOver={event => event.preventDefault()} onDrop={event => {
                  event.preventDefault();
                  if (draggedField.current) move(draggedField.current, index);
                  draggedField.current = null;
                }}>
                  <button
                    type="button"
                    className="attribute-grip"
                    draggable
                    aria-label={`Reorder ${fieldName}, position ${index + 1} of ${columns.length}`}
                    aria-describedby="attribute-order-hint"
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                    onKeyDown={event => {
                      if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                      event.preventDefault();
                      move(fieldName, index + (event.key === "ArrowLeft" ? -1 : 1));
                    }}
                    onDragStart={event => {
                      draggedField.current = fieldName;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", fieldName);
                    }}
                    onDragEnd={() => { draggedField.current = null; }}
                  >⠿</button>
                  <button type="button" className="attribute-field-name" aria-label={`Hide ${fieldName}`} onClick={() => onChange(columns.filter(name => name !== fieldName))}>{fieldName} <span aria-hidden="true">×</span></button>
                </li>
              ))}
            </ol>
            {columns.length === 0 && <p role="alert">Select at least one column.</p>}
            <h3 className="attribute-hidden-heading">Hidden columns ({hiddenFields.length})</h3>
            <label className="attribute-search">Search hidden columns<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <ul className="attribute-hidden-columns">
              {matchingFields.map(field => <li key={field.name}><button type="button" onClick={() => onChange([...columns, field.name])}>+ {field.name}</button></li>)}
            </ul>
            {matchingFields.length === 0 && <p>{hiddenFields.length === 0 ? "All columns are selected." : "No matching hidden columns."}</p>}
          </>}
        </div>
        <footer><button type="button" disabled={!isTableInitialized || columns.length === 0} onClick={onApply}>Apply table settings</button></footer>
      </div>
    </aside>
  );
}
