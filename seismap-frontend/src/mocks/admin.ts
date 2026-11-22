import type { DatasetItem, DBSCANRun, ParameterExperiment, ProcessingJob } from '../types/domain';

// Semua record di bawah hanya fixture visual, bukan data penelitian aktual.
export const previewDatasets: DatasetItem[] = [
  { id: 1, dataset_name: 'Gempa Indonesia 2021–2025 (Preview)', source_name: 'Fixture UI', start_date: '2021-01-01', end_date: '2025-12-31', raw_row_count: 59847, cleaned_row_count: 59847, rejected_row_count: 0, status: 'READY', created_at: '2026-11-14T08:00:00Z' },
];

export const previewExperiments: ParameterExperiment[] = [
  { id: 101, dataset_id: 1, job_id: 51, eps_km: 72, eps_radian: 0.0113, min_samples: 5, cluster_count: 18, noise_count: 7240, noise_percentage: 12.1, clustered_count: 52607, min_cluster_size: 44, median_cluster_size: 1850, max_cluster_size: 9100, silhouette_score: 0.42, silhouette_sample_size: 5000, is_valid: true, invalid_reason: null, is_recommended: true },
  { id: 102, dataset_id: 1, job_id: 51, eps_km: 64, eps_radian: 0.0100, min_samples: 8, cluster_count: 14, noise_count: 11020, noise_percentage: 18.4, clustered_count: 48827, min_cluster_size: 38, median_cluster_size: 1620, max_cluster_size: 8300, silhouette_score: 0.39, silhouette_sample_size: 5000, is_valid: true, invalid_reason: null, is_recommended: false },
  { id: 103, dataset_id: 1, job_id: 51, eps_km: 110, eps_radian: 0.0173, min_samples: 4, cluster_count: 6, noise_count: 2200, noise_percentage: 3.7, clustered_count: 57647, min_cluster_size: 220, median_cluster_size: 6900, max_cluster_size: 18000, silhouette_score: 0.28, silhouette_sample_size: 5000, is_valid: false, invalid_reason: 'Kandidat terlalu menggabungkan wilayah yang berjauhan.', is_recommended: false },
];

export const previewRuns: DBSCANRun[] = [
  { id: 31, dataset_id: 1, selected_experiment_id: 101, eps_km: 72, eps_radian: 0.0113, min_samples: 5, metric: 'haversine', cluster_count: 18, noise_count: 7240, noise_percentage: 12.1, total_points: 59847, silhouette_score: 0.42, status: 'SUCCESS', is_active: true, created_at: '2026-11-12T09:10:00Z', completed_at: '2026-11-12T09:18:00Z', activated_at: '2026-11-12T09:20:00Z' },
  { id: 29, dataset_id: 1, selected_experiment_id: 102, eps_km: 64, eps_radian: 0.0100, min_samples: 8, metric: 'haversine', cluster_count: 14, noise_count: 11020, noise_percentage: 18.4, total_points: 59847, silhouette_score: 0.39, status: 'ARCHIVED', is_active: false, created_at: '2026-11-09T13:00:00Z', completed_at: '2026-11-09T13:12:00Z', activated_at: null },
];


export const previewJobs: ProcessingJob[] = [
  { id: 16, dataset_id: 1, run_id: 32, job_type: 'FINAL_CLUSTERING', status: 'RUNNING', progress: 68, current_step: 'CLUSTER_ASSIGNMENT', message: 'Fixture preview: proses final clustering sedang berjalan.', error_code: null, created_at: '2026-11-15T08:20:00+07:00', started_at: '2026-11-15T08:20:04+07:00', finished_at: null },
  { id: 15, dataset_id: 1, run_id: null, job_type: 'PARAMETER_SEARCH', status: 'SUCCESS', progress: 100, current_step: 'PARAMETER_SEARCH', message: 'Fixture preview: 12 kombinasi diuji.', error_code: null, created_at: '2026-11-14T21:10:52+07:00', started_at: '2026-11-14T21:11:21+07:00', finished_at: '2026-11-14T21:14:00+07:00' },
  { id: 14, dataset_id: 1, run_id: null, job_type: 'PARAMETER_SEARCH', status: 'FAILED', progress: 35, current_step: 'KNEE_DETECTION', message: 'Fixture preview: knee point tidak ditemukan.', error_code: 'KNEE_NOT_FOUND', created_at: '2026-11-14T18:00:00+07:00', started_at: '2026-11-14T18:00:02+07:00', finished_at: '2026-11-14T18:01:10+07:00' },
];
