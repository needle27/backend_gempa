export interface AdminUser {
  id: number | string;
  email: string;
  username: string;
  role: string;
}

export interface DatasetItem {
  id: number;
  dataset_name: string;
  source_name: string;
  start_date: string;
  end_date: string;
  raw_row_count: number;
  cleaned_row_count: number;
  rejected_row_count: number;
  status: string;
  created_at: string | null;
}

export interface UploadResult {
  dataset_id: number;
  dataset_name: string;
  status: string;
  raw_row_count: number;
  cleaned_row_count: number;
  rejected_row_count: number;
  date_range: { start: string; end: string };
  file_hash_sha256: string;
}

export interface KneeSummaryItem {
  min_samples: number;
  knee_eps_km: number | null;
  p90_km?: number | null;
  p95_km?: number | null;
  p98_km?: number | null;
  detected: boolean;
  status: 'DETECTED' | 'NOT_DETECTED' | string;
}

export interface ValidityThresholds {
  min_clusters: number;
  max_clusters: number;
  max_noise_percentage: number;
  max_largest_cluster_ratio: number;
}

export interface RecommendationWeights {
  silhouette: number;
  noise_percentage: number;
  largest_cluster_ratio: number;
  stability_score: number;
}

export interface SelectedExperimentSummary {
  id: number;
  eps_km: number;
  min_samples: number;
  recommendation_score?: number | null;
  silhouette_score?: number | null;
  cluster_count?: number | null;
  noise_percentage?: number | null;
  stability_score?: number | null;
  largest_cluster_ratio?: number | null;
  max_cluster_size?: number | null;
}

export interface ProcessingJob {
  id: number;
  dataset_id: number;
  run_id: number | null;
  job_type: 'PARAMETER_SEARCH' | 'FINAL_CLUSTERING';
  status: 'QUEUED' | 'RUNNING' | 'PAUSE_REQUESTED' | 'PAUSED' | 'STOP_REQUESTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | string;
  progress: number;
  current_step: string | null;
  message: string | null;
  error_code: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  checkpoint_data?: Record<string, unknown> | null;
  pause_requested_at?: string | null;
  paused_at?: string | null;
  stop_requested_at?: string | null;
  parent_job_id?: number | null;
  parameter_search_metadata?: ParameterSearchMetadata | null;
  knee_summary?: KneeSummaryItem[] | null;
  validity_thresholds?: ValidityThresholds | null;
  recommendation_status?: 'RECOMMENDED' | 'NO_VALID_EXPERIMENT' | string | null;
  recommendation_weights?: RecommendationWeights | null;
  selected_experiment?: SelectedExperimentSummary | null;
}


export interface JobListResult {
  items: ProcessingJob[];
  total: number | null;
  page: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EpsilonCandidateMetadata {
  eps_km: number;
  eps_sources?: string[] | null;
}

export interface ParameterSearchMetadata {
  method_version?: string | null;
  default_grid_km?: number[] | null;
  default_grid?: number[] | null;
  epsilon_candidates_km?: number[] | null;
  epsilon_candidates?: EpsilonCandidateMetadata[] | null;
  epsilon_candidate_strategy?: string | null;
  candidate_count_before_deduplication?: number | null;
  candidate_count_after_deduplication?: number | null;
  combination_count?: number | null;
  min_samples_candidates?: number[] | null;
  use_default_grid?: boolean | null;
  epsilon_candidate_count?: number | null;
  epsilon_rounding_km?: number | null;
  rounding_km?: number | null;
  knee_not_detected_min_samples?: number[] | null;
  knee_not_found?: number[] | null;
  knee_summary?: KneeSummaryItem[] | null;
  validity_thresholds?: ValidityThresholds | null;
  recommendation_status?: string | null;
  recommendation_weights?: RecommendationWeights | null;
  selected_experiment?: SelectedExperimentSummary | null;
  recommendation?: {
    status?: string | null;
    recommendation_status?: string | null;
    recommendation_weights?: RecommendationWeights | null;
    selected_experiment?: SelectedExperimentSummary | null;
  } | null;
  combination_mode?: string | null;
  sensitivity_percentages?: number[] | null;
  source_candidate_counts?: Record<string, number> | null;
  candidate_status?: string | Record<string, unknown> | null;
}

export interface ExperimentParameterSearchMetadata {
  method_version?: string | null;
  eps_sources?: string[] | null;
  epsilon_rounding_km?: number | null;
  rounding_km?: number | null;
  eps_radian?: number | null;
  combination_mode?: string | null;
  use_default_grid?: boolean | null;
  epsilon_candidate_strategy?: string | null;
}

export interface ParameterExperiment {
  id: number;
  dataset_id: number;
  job_id: number;
  eps_km: number;
  eps_radian: number;
  min_samples: number;
  cluster_count: number;
  noise_count: number;
  noise_percentage: number | null;
  clustered_count: number;
  min_cluster_size: number | null;
  median_cluster_size: number | null;
  max_cluster_size: number | null;
  largest_cluster_ratio?: number | null;
  silhouette_score: number | null;
  silhouette_sample_size: number | null;
  stability_score?: number | null;
  recommendation_score?: number | null;
  is_valid: boolean;
  invalid_reason: string | null;
  invalid_reasons?: string[] | null;
  is_recommended: boolean;
  eps_sources?: string[] | null;
  epsilon_rounding_km?: number | null;
  method_version?: string | null;
  evaluation_metadata?: {
    parameter_search?: ExperimentParameterSearchMetadata | null;
    largest_cluster_ratio?: number | null;
    stability_score?: number | null;
    recommendation_score?: number | null;
    invalid_reasons?: string[] | null;
    [key: string]: unknown;
  } | null;
}

export interface DBSCANRun {
  id: number;
  dataset_id: number;
  selected_experiment_id: number;
  eps_km: number;
  eps_radian: number;
  min_samples: number;
  metric: string;
  cluster_count: number | null;
  noise_count: number | null;
  noise_percentage: number | null;
  total_points: number | null;
  silhouette_score: number | null;
  status: 'DRAFT' | 'CLUSTERING' | 'SUCCESS' | 'FAILED' | 'ARCHIVED' | string;
  is_active: boolean;
  created_at: string | null;
  completed_at: string | null;
  activated_at: string | null;
}

export interface PublicMetadata {
  dataset: {
    id: number;
    name: string;
    source_name: string;
    start_date: string;
    end_date: string;
    raw_row_count: number;
    cleaned_row_count: number;
  } | null;
  run: {
    id: number;
    status: string;
    eps_km: number;
    eps_radian: number;
    min_samples: number;
    metric: string;
    earth_radius_km: number;
    created_at: string | null;
    completed_at: string | null;
    activated_at: string | null;
  } | null;
}

export interface PublicSummary {
  dataset_id: number;
  dataset_name: string;
  total_points: number;
  cluster_count: number;
  noise_count: number;
  noise_percentage: number;
  silhouette_score: number | null;
  profile_count: number;
}

export interface ClusterProfile {
  cluster_id: number;
  event_count: number;
  avg_magnitude: number | null;
  min_magnitude: number | null;
  max_magnitude: number | null;
  avg_depth: number | null;
  min_depth: number | null;
  max_depth: number | null;
  shallow_event_count: number;
  medium_event_count: number;
  deep_event_count: number;
  first_event_date: string | null;
  last_event_date: string | null;
  centroid_latitude: number | null;
  centroid_longitude: number | null;
  dominant_location: string | null;
  radius_km: number | null;
  max_radius_km: number | null;
}

export interface ResearchEarthquake {
  id: number;
  event_id: string;
  tanggal: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  kedalaman: number | null;
  lokasi: string | null;
  cluster_id: number;
  is_noise: boolean;
}

export interface RealtimeEarthquake {
  event_time_utc: string | null;
  date_local: string | null;
  time_local: string | null;
  magnitude: number;
  depth_km: number | null;
  latitude: number;
  longitude: number;
  coordinates: [number, number];
  latitude_label: string | null;
  longitude_label: string | null;
  depth_label: string | null;
  region: string | null;
  tsunami_potential: string | null;
  felt: string | null;
  shakemap_url: string | null;
}

export interface RealtimeFeed<T> {
  source: 'BMKG';
  source_name: string;
  source_url: string;
  category: 'latest' | 'm5' | 'felt';
  fetched_at: string;
  cache_status: 'MISS' | 'HIT' | 'STALE';
  is_stale: boolean;
  warning: string | null;
  cache_ttl_seconds: number;
  count: number;
  earthquake?: T;
  earthquakes?: T[];
}

export interface DatasetValidationResult {
  valid?: boolean;
  persisted?: false;
  filename?: string;
  file_hash_sha256?: string;
  row_count?: number;
  required_columns?: string[];
  rules?: Record<string, unknown>;
}

/** Audit row fields follow the BE audit model; optional fields allow serializers to omit null metadata. */
export interface AuditLogRecord {
  id?: number;
  user_id?: number | null;
  action?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  details?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  username?: string | null;
  email?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AuditLogResult {
  items: AuditLogRecord[];
  count: number;
  limit: number;
  offset: number;
}

export type AdminDetailRecord = Record<string, unknown>;
