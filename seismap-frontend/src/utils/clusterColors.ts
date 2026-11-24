/**
 * Shared deterministic colors for DBSCAN cluster identifiers.
 * The same cluster_id receives the same color in maps and charts.
 */
export const CLUSTER_PALETTE = [
  '#48D7ED', // cyan
  '#9583FF', // violet
  '#48C9A7', // teal
  '#F3B85F', // amber
  '#6CA8FF', // blue
  '#E47BB4', // pink
  '#A5C66D', // sage green
  '#F08B67', // coral
  '#FACC15', // bright yellow
  '#FB7185', // crimson rose
  '#38BDF8', // sky blue
  '#C084FC', // orchid purple
  '#4ADE80', // emerald green
  '#FB923C', // vivid orange
  '#818CF8', // periwinkle indigo
  '#E879F9', // fuchsia orchid
  '#2DD4BF', // turquoise
  '#F87171', // warm red
  '#BEF264', // chartreuse
  '#FDBA74', // apricot peach
  '#67E8F9', // aqua glow
  '#D8B4FE', // pale lilac
  '#6EE7B7', // seafoam mint
  '#FDE047', // canary gold
  '#93C5FD', // powder blue
  '#FDA4AF', // blush rose
  '#86EFAC', // spring pastel
  '#F472B6', // magenta pink
  '#FCD34D', // marigold
  '#A5B4FC', // lavender blue
] as const;

export const DEPTH_CATEGORY_COLORS = {
  shallow: '#42C5D8',
  medium: '#9583FF',
  deep: '#F3B85F',
} as const;

export const NOISE_COLOR = '#8B98A8';

const GOLDEN_ANGLE_DEG = 137.508;

export function clusterColor(clusterId: number): string {
  if (!Number.isFinite(clusterId)) return NOISE_COLOR;
  const normalizedId = Math.trunc(clusterId);
  if (normalizedId < 0) return NOISE_COLOR;
  if (normalizedId < CLUSTER_PALETTE.length) {
    return CLUSTER_PALETTE[normalizedId];
  }
  // Deterministic golden-angle HSL fallback so 30+ clusters stay high-contrast without modulo collisions.
  const overflowOffset = normalizedId - CLUSTER_PALETTE.length + 1;
  const hue = Number(((overflowOffset * GOLDEN_ANGLE_DEG) % 360).toFixed(1));
  const saturation = 72 + ((overflowOffset * 7) % 16);
  const lightness = 60 + ((overflowOffset * 5) % 14);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
