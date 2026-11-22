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
  '#A5C66D', // green
  '#F08B67', // coral
  '#6EC8D9', // light cyan
  '#B28CF4', // lavender
] as const;


export const DEPTH_CATEGORY_COLORS = {
  shallow: '#42C5D8',
  medium: '#9583FF',
  deep: '#F3B85F',
} as const;

export const NOISE_COLOR = '#8B98A8';

export function clusterColor(clusterId: number): string {
  if (!Number.isFinite(clusterId) || clusterId === -1) return NOISE_COLOR;
  const index = Math.abs(Math.trunc(clusterId)) % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[index];
}
