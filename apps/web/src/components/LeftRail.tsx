import './styles.css';

type LeftRailProps = {
  isAttributeDrawerOpen: boolean;
  onToggleAttributeDrawer: () => void;
};

export default function LeftRail({ isAttributeDrawerOpen, onToggleAttributeDrawer }: LeftRailProps) {
  return (
    <nav className="left-rail" aria-label="Map settings">
      <button
        type="button"
        aria-label="Table attribute display settings"
        aria-pressed={isAttributeDrawerOpen}
        onClick={onToggleAttributeDrawer}
      >
        {/* Future: Replace the hand-drawn SVG with Font Awesome or an approved icon set. */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="1" />
          <path d="M3 9h18M3 14h18M10 4v16" />
        </svg>
        Table
      </button>
    </nav>
  );
}
