/**
 * A standard rule-of-thirds grid. Thin, low contrast, and switchable — it helps
 * composition without competing with the picture (§48).
 */
export function CameraGrid() {
  return (
    <svg className="cam__grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="33.33" y1="0" x2="33.33" y2="100" />
      <line x1="66.66" y1="0" x2="66.66" y2="100" />
      <line x1="0" y1="33.33" x2="100" y2="33.33" />
      <line x1="0" y1="66.66" x2="100" y2="66.66" />
    </svg>
  );
}
