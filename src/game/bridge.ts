/** Shared, non-reactive channel between React UI and the Phaser scene. */
export const bridge = {
  dir: { x: 0, y: 0 },
  zoomBy: (_d: number) => {},
  interact: () => {},
  recenter: () => {},
};
