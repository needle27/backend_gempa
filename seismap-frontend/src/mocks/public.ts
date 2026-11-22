import type { ClusterProfile, PublicMetadata, PublicSummary, ResearchEarthquake } from '../types/domain';

// Fixture ini hanya dimuat dalam VITE_UI_PREVIEW_MODE=true dan selalu diberi label Data Simulasi.
export const previewMetadata: PublicMetadata = {
  dataset: { id: 1, name: 'Preview Dataset Gempa Indonesia', source_name: 'Fixture UI', start_date: '2021-01-01', end_date: '2025-12-31', raw_row_count: 59847, cleaned_row_count: 59847 },
  run: { id: 1, status: 'SUCCESS', eps_km: 85, eps_radian: 0.01334, min_samples: 5, metric: 'haversine', earth_radius_km: 6371, created_at: '2026-11-10T08:00:00Z', completed_at: '2026-11-10T08:15:00Z', activated_at: '2026-11-10T08:20:00Z' },
};

export const previewSummary: PublicSummary = {
  dataset_id: 1, dataset_name: 'Preview Dataset Gempa Indonesia', total_points: 59847, cluster_count: 18,
  noise_count: 7240, noise_percentage: 12.1, silhouette_score: 0.42, profile_count: 18,
};

export const previewProfiles: ClusterProfile[] = Array.from({ length: 8 }, (_, i) => ({
  cluster_id: i + 1,
  event_count: [12500, 9200, 7300, 6100, 4800, 3900, 2800, 2100][i],
  avg_magnitude: 3.8 + (i % 4) * 0.2, min_magnitude: 1.2, max_magnitude: 6.4,
  avg_depth: 24 + i * 11, min_depth: 2, max_depth: 180,
  shallow_event_count: 700 + i * 100, medium_event_count: 500 + i * 90, deep_event_count: 200 + i * 40,
  first_event_date: '2021-01-04', last_event_date: '2025-12-28',
  centroid_latitude: -7.5 + i * 1.1, centroid_longitude: 110 + i * 2.2,
  dominant_location: ['Jawa', 'Sumatra', 'Sulawesi', 'Maluku', 'Papua', 'Bali', 'Nusa Tenggara', 'Laut Banda'][i],
  radius_km: 110 + i * 8, max_radius_km: 260 + i * 12,
}));

const samplePoints: Array<[number, number, number]> = [
  [-6.8, 107.6, 1], [-7.2, 110.4, 1], [-8.1, 112.2, 1], [-3.5, 102.1, 2], [-2.9, 100.2, 2],
  [-1.2, 120.1, 3], [-2.4, 121.8, 3], [-5.2, 130.5, 4], [-6.1, 129.2, 4], [-4.8, 138.4, 5],
  [-3.6, 136.9, 5], [-9.1, 119.7, 6], [-8.7, 116.2, 6], [1.2, 126.4, 7], [0.7, 127.1, 7],
  [-7.5, 114.1, -1], [-4.2, 124.2, -1], [2.4, 127.6, -1], [-8.4, 123.3, 8], [-6.9, 130.8, 8],
];
export const previewEarthquakes: ResearchEarthquake[] = samplePoints.map(([latitude, longitude, cluster_id], i) => ({
  id: i + 1, event_id: `PREVIEW-${String(i + 1).padStart(4, '0')}`, tanggal: `202${1 + (i % 5)}-0${1 + (i % 9)}-12T03:15:00+07:00`,
  latitude, longitude, magnitude: Number((2.8 + (i % 6) * 0.45).toFixed(1)), kedalaman: 8 + i * 7,
  lokasi: ['Jawa Barat', 'Sumatera Selatan', 'Sulawesi Tengah', 'Maluku', 'Papua'][i % 5],
  cluster_id, is_noise: cluster_id === -1,
}));
