import { getActiveLanguage } from '../i18n/LanguageContext';
import type { Language } from '../i18n/types';

const STATUS_LABELS_ID: Record<string, string> = {
  SUCCESS: 'Berhasil',
  READY: 'Siap',
  PROCESSED: 'Siap',
  ACTIVE: 'Aktif',
  VALID: 'Valid',
  RECOMMENDED: 'Direkomendasikan',
  FAILED: 'Gagal',
  CANCELLED: 'Dihentikan',
  STOPPED: 'Dihentikan',
  STOP_REQUESTED: 'Dihentikan',
  ERROR: 'Kesalahan',
  INVALID: 'Tidak Valid',
  RUNNING: 'Berjalan',
  QUEUED: 'Antrean',
  PENDING: 'Antrean',
  PAUSE_REQUESTED: 'Dijeda',
  PAUSED: 'Dijeda',
  RESUMING: 'Melanjutkan',
  CLUSTERING: 'Membentuk klaster',
  DRAFT: 'Draf',
  ARCHIVED: 'Diarsipkan',
  STALE: 'Data tersimpan sementara',
  HIT: 'Tersedia di cache',
  MISS: 'Diambil dari sumber',
  PROCESSING: 'Sedang diproses',
  UPLOADING: 'Sedang diunggah',
  VALIDATING: 'Sedang diperiksa',
  REJECTED: 'Ditolak',
  AVAILABLE: 'Tersedia',
  NO_ACTIVE_RUN: 'Belum ada hasil aktif',
  NO_VALID_EXPERIMENT: 'Tidak ada eksperimen valid',
  HISTORIS: 'Data historis',
};

const STATUS_LABELS_EN: Record<string, string> = {
  SUCCESS: 'Success',
  READY: 'Ready',
  PROCESSED: 'Ready',
  ACTIVE: 'Active',
  VALID: 'Valid',
  RECOMMENDED: 'Recommended',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  STOPPED: 'Stopped',
  STOP_REQUESTED: 'Stopping',
  ERROR: 'Error',
  INVALID: 'Invalid',
  RUNNING: 'Running',
  QUEUED: 'Queued',
  PENDING: 'Pending',
  PAUSE_REQUESTED: 'Pausing',
  PAUSED: 'Paused',
  RESUMING: 'Resuming',
  CLUSTERING: 'Clustering',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
  STALE: 'Cached temporarily',
  HIT: 'Cache hit',
  MISS: 'Fetched live',
  PROCESSING: 'Processing',
  UPLOADING: 'Uploading',
  VALIDATING: 'Validating',
  REJECTED: 'Rejected',
  AVAILABLE: 'Available',
  NO_ACTIVE_RUN: 'No active run',
  NO_VALID_EXPERIMENT: 'No valid experiment',
  HISTORIS: 'Historical data',
};

const JOB_TYPE_LABELS_ID: Record<string, string> = {
  PARAMETER_SEARCH: 'Pencarian Parameter',
  FINAL_CLUSTERING: 'Klasterisasi Final',
};

const JOB_TYPE_LABELS_EN: Record<string, string> = {
  PARAMETER_SEARCH: 'Parameter Search',
  FINAL_CLUSTERING: 'Final Clustering',
};

const STEP_LABELS_ID: Record<string, string> = {
  QUEUED: 'Menunggu giliran proses',
  STARTING: 'Memulai proses',
  PREPARING: 'Menyiapkan data',
  LOADING_DATA: 'Memuat data gempa',
  VALIDATING: 'Memeriksa data',
  PARAMETER_SEARCH: 'Mencari kombinasi parameter',
  KNN: 'Menghitung jarak tetangga (KNN)',
  KNN_DISTANCE: 'Menghitung jarak tetangga (KNN)',
  K_DISTANCE: 'Menyusun kurva k-distance',
  KNEE: 'Mendeteksi titik knee',
  KNEE_DETECTION: 'Mendeteksi titik knee',
  GRID_SEARCH: 'Menguji kombinasi parameter',
  DBSCAN: 'Menjalankan DBSCAN',
  FINAL_CLUSTERING: 'Membentuk klaster akhir',
  CLUSTERING: 'Membentuk klaster',
  PROFILING: 'Menyusun profil klaster',
  EVALUATION: 'Mengevaluasi hasil klaster',
  SAVING: 'Menyimpan hasil',
  SAVING_RESULTS: 'Menyimpan hasil',
  WAITING_FOR_WORKER: 'Menunggu petugas proses',
  CALCULATING_METRICS: 'Menghitung metrik evaluasi',
  PROFILING_DEPTH: 'Menyusun profil kedalaman',
  PERSISTING: 'Menyimpan hasil',
  ACTIVATING: 'Mengaktifkan hasil',
  FINALIZING: 'Menyelesaikan proses',
  COMPLETED: 'Proses selesai',
  SUCCESS: 'Proses selesai',
  FAILED: 'Proses gagal',
};

const STEP_LABELS_EN: Record<string, string> = {
  QUEUED: 'Queued for execution',
  STARTING: 'Starting job',
  PREPARING: 'Preparing dataset',
  LOADING_DATA: 'Loading earthquake records',
  VALIDATING: 'Validating records',
  PARAMETER_SEARCH: 'Searching parameter combinations',
  KNN: 'Computing neighbor distances (KNN)',
  KNN_DISTANCE: 'Computing neighbor distances (KNN)',
  K_DISTANCE: 'Building k-distance curve',
  KNEE: 'Detecting knee point',
  KNEE_DETECTION: 'Detecting knee point',
  GRID_SEARCH: 'Evaluating parameter grid',
  DBSCAN: 'Running DBSCAN',
  FINAL_CLUSTERING: 'Building final clusters',
  CLUSTERING: 'Forming clusters',
  PROFILING: 'Profiling clusters',
  EVALUATION: 'Evaluating cluster metrics',
  SAVING: 'Saving results',
  SAVING_RESULTS: 'Saving results',
  WAITING_FOR_WORKER: 'Waiting for execution slot',
  CALCULATING_METRICS: 'Computing evaluation metrics',
  PROFILING_DEPTH: 'Profiling depth categories',
  PERSISTING: 'Persisting results',
  ACTIVATING: 'Activating run',
  FINALIZING: 'Finalizing job',
  COMPLETED: 'Job completed',
  SUCCESS: 'Job completed',
  FAILED: 'Job failed',
};

const FIELD_LABELS_ID: Record<string, string> = {
  id: 'ID', request_id: 'ID Referensi Permintaan', dataset_id: 'ID Dataset', dataset_name: 'Nama Dataset', source_name: 'Sumber Data',
  start_date: 'Tanggal Awal', end_date: 'Tanggal Akhir', created_at: 'Waktu Dibuat', updated_at: 'Terakhir Diperbarui',
  started_at: 'Waktu Mulai', finished_at: 'Waktu Selesai', completed_at: 'Waktu Selesai', activated_at: 'Waktu Diaktifkan',
  raw_row_count: 'Jumlah Baris Awal', total: 'Jumlah Total', count: 'Jumlah Data', offset: 'Posisi Data', page: 'Halaman', limit: 'Jumlah per Halaman', cleaned_row_count: 'Jumlah Baris Bersih', rejected_row_count: 'Jumlah Baris Ditolak',
  row_count: 'Jumlah Baris', total_points: 'Jumlah Titik Gempa', cluster_count: 'Jumlah Klaster', noise_count: 'Jumlah Noise',
  noise_percentage: 'Persentase Noise', clustered_count: 'Jumlah Titik dalam Klaster', event_count: 'Jumlah Kejadian',
  eps_km: 'Epsilon', eps_radian: 'Epsilon (radian)', min_samples: 'MinPts', metric: 'Metrik Jarak',
  silhouette_score: 'Skor Silhouette', silhouette_sample_size: 'Jumlah Sampel Evaluasi',
  status: 'Status', job_type: 'Jenis Proses', job_id: 'ID Proses', run_id: 'ID Run', parent_job_id: 'Proses Sebelumnya', current_step: 'Tahap Saat Ini',
  pause_requested_at: 'Waktu Permintaan Jeda', paused_at: 'Waktu Dijeda', stop_requested_at: 'Waktu Permintaan Penghentian',
  progress: 'Kemajuan', message: 'Keterangan', error_code: 'Kode Kesalahan', error: 'Keterangan Kesalahan', reason: 'Alasan', filename: 'Nama File',
  valid: 'Validitas File', persisted: 'Disimpan sebagai Dataset', required_columns: 'Kolom Wajib',
  rules: 'Aturan Pemeriksaan', file_hash_sha256: 'Sidik File (SHA-256)', is_active: 'Sedang Aktif',
  is_valid: 'Validitas Eksperimen', is_recommended: 'Direkomendasikan', invalid_reason: 'Alasan Tidak Valid',
  username: 'Nama Pengguna', email: 'Email', user_id: 'ID Pengguna', entity_type: 'Jenis Objek', entity_id: 'ID Objek',
  action: 'Tindakan', details: 'Rincian', ip_address: 'Alamat IP', user_agent: 'Perangkat/Browser',
  date_range: 'Rentang Tanggal', source_url: 'Tautan Sumber', latitude: 'Latitude', longitude: 'Longitude', magnitude: 'Magnitudo', depth: 'Kedalaman', preprocessing_version: 'Versi Prapemrosesan',
  average_magnitude: 'Rata-rata Magnitudo', avg_magnitude: 'Rata-rata Magnitudo', min_magnitude: 'Magnitudo Minimum',
  max_magnitude: 'Magnitudo Maksimum', avg_depth: 'Rata-rata Kedalaman', min_depth: 'Kedalaman Minimum',
  max_depth: 'Kedalaman Maksimum', shallow_event_count: 'Gempa Dangkal', medium_event_count: 'Gempa Menengah',
  deep_event_count: 'Gempa Dalam', dominant_location: 'Lokasi Dominan', centroid_latitude: 'Lintang Titik Pusat',
  centroid_longitude: 'Bujur Titik Pusat', radius_km: 'Radius Klaster', first_event_date: 'Tanggal Kejadian Pertama',
  last_event_date: 'Tanggal Kejadian Terakhir', selected_experiment_id: 'ID Eksperimen Terpilih',
  max_cluster_size: 'Ukuran Klaster Terbesar', largest_cluster_ratio: 'Dominasi Klaster Terbesar',
  stability_score: 'Skor Stabilitas', recommendation_score: 'Skor Rekomendasi',
  invalid_reasons: 'Alasan Tidak Valid', eps_sources: 'Sumber Epsilon',
  knee_summary: 'Ringkasan Deteksi Knee', validity_thresholds: 'Ambang Validitas',
  recommendation_status: 'Status Rekomendasi', recommendation_weights: 'Bobot Rekomendasi',
  selected_experiment: 'Eksperimen Rekomendasi',
  role: 'Peran', deactivated_at: 'Waktu Dinonaktifkan', task_id: 'ID Tugas',
  min_samples_candidates: 'Kandidat MinPts', sensitivity_percentages: 'Persentase Sensitivitas',
  eps_candidates_km: 'Kandidat Epsilon Eksplisit (km)', use_default_grid: 'Gunakan Grid Standar',
  combination_count: 'Jumlah Kombinasi', valid_count: 'Jumlah Valid',
  total_experiments: 'Total Eksperimen', recommended_experiment_id: 'ID Eksperimen Rekomendasi',
};

const FIELD_LABELS_EN: Record<string, string> = {
  id: 'ID', request_id: 'Request Reference ID', dataset_id: 'Dataset ID', dataset_name: 'Dataset Name', source_name: 'Data Source',
  start_date: 'Start Date', end_date: 'End Date', created_at: 'Created At', updated_at: 'Updated At',
  started_at: 'Started At', finished_at: 'Finished At', completed_at: 'Completed At', activated_at: 'Activated At',
  raw_row_count: 'Raw Row Count', total: 'Total Count', count: 'Item Count', offset: 'Offset', page: 'Page', limit: 'Items per Page', cleaned_row_count: 'Cleaned Row Count', rejected_row_count: 'Rejected Row Count',
  row_count: 'Row Count', total_points: 'Total Earthquake Points', cluster_count: 'Cluster Count', noise_count: 'Noise Count',
  noise_percentage: 'Noise Percentage', clustered_count: 'Clustered Points', event_count: 'Event Count',
  eps_km: 'Epsilon', eps_radian: 'Epsilon (radian)', min_samples: 'MinPts', metric: 'Distance Metric',
  silhouette_score: 'Silhouette Score', silhouette_sample_size: 'Evaluation Sample Size',
  status: 'Status', job_type: 'Job Type', job_id: 'Job ID', run_id: 'Run ID', parent_job_id: 'Parent Job', current_step: 'Current Step',
  pause_requested_at: 'Pause Requested At', paused_at: 'Paused At', stop_requested_at: 'Stop Requested At',
  progress: 'Progress', message: 'Message', error_code: 'Error Code', error: 'Error Details', reason: 'Reason', filename: 'File Name',
  valid: 'File Validity', persisted: 'Saved as Dataset', required_columns: 'Required Columns',
  rules: 'Validation Rules', file_hash_sha256: 'File Hash (SHA-256)', is_active: 'Is Active',
  is_valid: 'Experiment Validity', is_recommended: 'Recommended', invalid_reason: 'Invalidity Reason',
  username: 'Username', email: 'Email', user_id: 'User ID', entity_type: 'Entity Type', entity_id: 'Entity ID',
  action: 'Action', details: 'Details', ip_address: 'IP Address', user_agent: 'Device/Browser',
  date_range: 'Date Range', source_url: 'Source URL', latitude: 'Latitude', longitude: 'Longitude', magnitude: 'Magnitude', depth: 'Depth', preprocessing_version: 'Preprocessing Version',
  average_magnitude: 'Average Magnitude', avg_magnitude: 'Average Magnitude', min_magnitude: 'Minimum Magnitude',
  max_magnitude: 'Maximum Magnitude', avg_depth: 'Average Depth', min_depth: 'Minimum Depth',
  max_depth: 'Maximum Depth', shallow_event_count: 'Shallow Events', medium_event_count: 'Intermediate Events',
  deep_event_count: 'Deep Events', dominant_location: 'Dominant Location', centroid_latitude: 'Centroid Latitude',
  centroid_longitude: 'Centroid Longitude', radius_km: 'Cluster Radius', first_event_date: 'First Event Date',
  last_event_date: 'Last Event Date', selected_experiment_id: 'Selected Experiment ID',
  max_cluster_size: 'Largest Cluster Size', largest_cluster_ratio: 'Largest Cluster Dominance',
  stability_score: 'Stability Score', recommendation_score: 'Recommendation Score',
  invalid_reasons: 'Invalidity Reasons', eps_sources: 'Epsilon Sources',
  knee_summary: 'Knee Detection Summary', validity_thresholds: 'Validity Thresholds',
  recommendation_status: 'Recommendation Status', recommendation_weights: 'Recommendation Weights',
  selected_experiment: 'Recommended Experiment',
  role: 'Role', deactivated_at: 'Deactivated At', task_id: 'Task ID',
  min_samples_candidates: 'MinPts Candidates', sensitivity_percentages: 'Sensitivity Percentages',
  eps_candidates_km: 'Explicit Epsilon Candidates (km)', use_default_grid: 'Use Standard Grid',
  combination_count: 'Combination Count', valid_count: 'Valid Count',
  total_experiments: 'Total Experiments', recommended_experiment_id: 'Recommended Experiment ID',
};

const INVALID_REASON_LABELS_ID: Record<string, string> = {
  CLUSTER_COUNT_BELOW_MINIMUM: 'Jumlah klaster di bawah batas minimum',
  CLUSTER_COUNT_ABOVE_MAXIMUM: 'Jumlah klaster melebihi batas maksimum',
  NOISE_PERCENTAGE_ABOVE_MAXIMUM: 'Persentase noise melebihi ambang batas maksimum',
  NOISE_PERCENTAGE_UNAVAILABLE: 'Persentase noise tidak tersedia',
  LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM: 'Dominasi klaster terbesar terlalu tinggi',
  LARGEST_CLUSTER_RATIO_UNAVAILABLE: 'Rasio klaster terbesar tidak tersedia',
  min_clusters_not_met: 'Jumlah klaster di bawah batas minimum',
  max_clusters_exceeded: 'Jumlah klaster melebihi batas maksimum',
  noise_percentage_exceeds_max: 'Persentase noise melebihi ambang batas maksimum',
  largest_cluster_ratio_exceeds_max: 'Dominasi klaster terbesar terlalu tinggi',
};

const INVALID_REASON_LABELS_EN: Record<string, string> = {
  CLUSTER_COUNT_BELOW_MINIMUM: 'Cluster count is below the minimum threshold',
  CLUSTER_COUNT_ABOVE_MAXIMUM: 'Cluster count exceeds the maximum threshold',
  NOISE_PERCENTAGE_ABOVE_MAXIMUM: 'Noise percentage exceeds the maximum threshold',
  NOISE_PERCENTAGE_UNAVAILABLE: 'Noise percentage is unavailable',
  LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM: 'Largest cluster dominance is too high',
  LARGEST_CLUSTER_RATIO_UNAVAILABLE: 'Largest cluster ratio is unavailable',
  min_clusters_not_met: 'Cluster count is below the minimum threshold',
  max_clusters_exceeded: 'Cluster count exceeds the maximum threshold',
  noise_percentage_exceeds_max: 'Noise percentage exceeds the maximum threshold',
  largest_cluster_ratio_exceeds_max: 'Largest cluster dominance is too high',
};

export interface ValidityThresholds {
  min_clusters?: number;
  max_clusters?: number;
  max_noise_percentage?: number;
  max_largest_cluster_ratio?: number;
}

export function formatInvalidReason(
  reason: string,
  validityThresholds?: ValidityThresholds | null,
  lang: Language = getActiveLanguage(),
): string {
  if (!reason) return '—';
  const trimmed = reason.trim();
  const labels = lang === 'en' ? INVALID_REASON_LABELS_EN : INVALID_REASON_LABELS_ID;
  const match = trimmed.match(/^([A-Za-z0-9_]+)(?:\s*\((.*)\))?$/);
  if (match) {
    const [, code, details] = match;
    let baseLabel =
      labels[code] ||
      labels[code.toUpperCase()] ||
      humanizeCode(code);

    if (validityThresholds) {
      if ((code === 'CLUSTER_COUNT_BELOW_MINIMUM' || code === 'min_clusters_not_met') && validityThresholds.min_clusters != null) {
        baseLabel = lang === 'en'
          ? `Cluster count is below minimum (${validityThresholds.min_clusters})`
          : `Jumlah klaster di bawah batas minimum (${validityThresholds.min_clusters})`;
      } else if ((code === 'CLUSTER_COUNT_ABOVE_MAXIMUM' || code === 'max_clusters_exceeded') && validityThresholds.max_clusters != null) {
        baseLabel = lang === 'en'
          ? `Cluster count exceeds maximum (${validityThresholds.max_clusters})`
          : `Jumlah klaster melebihi batas maksimum (${validityThresholds.max_clusters})`;
      } else if ((code === 'NOISE_PERCENTAGE_ABOVE_MAXIMUM' || code === 'noise_percentage_exceeds_max') && validityThresholds.max_noise_percentage != null) {
        baseLabel = lang === 'en'
          ? `Noise percentage exceeds threshold (${validityThresholds.max_noise_percentage}%)`
          : `Persentase noise melebihi ambang batas (${validityThresholds.max_noise_percentage}%)`;
      } else if ((code === 'LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM' || code === 'largest_cluster_ratio_exceeds_max') && validityThresholds.max_largest_cluster_ratio != null) {
        baseLabel = lang === 'en'
          ? `Largest cluster dominance exceeds threshold (${Math.round(validityThresholds.max_largest_cluster_ratio * 100)}%)`
          : `Dominasi klaster terbesar melebihi ambang batas (${Math.round(validityThresholds.max_largest_cluster_ratio * 100)}%)`;
      }
    }

    return details ? `${baseLabel} (${details})` : baseLabel;
  }
  return labels[trimmed] || trimmed;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return '—';
  }
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted}%`;
}

export function formatRatioPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return '—';
  }
  return formatPercent(value * 100, digits);
}

const ERROR_LABELS_ID: Record<string, string> = {
  JOB_ALREADY_RUNNING: 'Masih ada proses sejenis yang sedang berjalan. Periksa Manajemen Proses sebelum mencoba lagi.',
  JOB_FAILED: 'Proses gagal dijalankan. Buka rincian proses untuk melihat keterangannya.',
  NOT_FOUND: 'Data yang diminta tidak ditemukan.',
  UNAUTHORIZED: 'Sesi masuk tidak valid atau telah berakhir. Silakan masuk kembali.',
  FORBIDDEN: 'Akun ini tidak memiliki izin untuk melakukan tindakan tersebut.',
  CSRF_COOKIE_MISSING: 'Sesi keamanan belum siap. Muat ulang halaman, lalu masuk kembali.',
  INVALID_RESPONSE: 'Respons server tidak sesuai format yang diharapkan. Silakan coba lagi.',
  INTERNAL_SERVER_ERROR: 'Terjadi gangguan pada server. Silakan coba lagi beberapa saat.',
  NETWORK_ERROR: 'Tidak dapat terhubung ke server. Periksa koneksi dan pastikan server sedang berjalan.',
  INVALID_CREDENTIALS: 'Email atau nama pengguna dan kata sandi tidak sesuai.',
  EXPERIMENT_NOT_FOUND: 'Eksperimen yang dipilih tidak ditemukan.',
  DATASET_NOT_READY: 'Dataset belum siap untuk diproses.',
  NO_VALID_EXPERIMENTS: 'Tidak ditemukan eksperimen valid untuk dataset ini.',
  VALIDATION_ERROR: 'Data yang dikirim belum memenuhi aturan pemeriksaan. Periksa kembali isian Anda.',
  JOB_LIFECYCLE_CONFLICT: 'Tindakan tidak dapat dilakukan pada status proses saat ini, atau data awal untuk mulai ulang tidak tersedia.',
  JOB_LIFECYCLE_FAILED: 'Sistem gagal memproses perubahan status. Rincian proses telah dimuat ulang; periksa status sebelum mencoba kembali.',
};

const ERROR_LABELS_EN: Record<string, string> = {
  JOB_ALREADY_RUNNING: 'A similar job is already running. Check Job Management before retrying.',
  JOB_FAILED: 'Job execution failed. Open job details for more information.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'Your session is invalid or has expired. Please sign in again.',
  FORBIDDEN: 'This account does not have permission to perform this action.',
  CSRF_COOKIE_MISSING: 'Security session is not ready. Reload the page and sign in again.',
  INVALID_RESPONSE: 'Server response format was unexpected. Please try again.',
  INTERNAL_SERVER_ERROR: 'A server error occurred. Please try again shortly.',
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and verify the server is running.',
  INVALID_CREDENTIALS: 'Email/username or password is incorrect.',
  EXPERIMENT_NOT_FOUND: 'The selected experiment was not found.',
  DATASET_NOT_READY: 'Dataset is not ready for processing.',
  NO_VALID_EXPERIMENTS: 'No valid experiments were found for this dataset.',
  VALIDATION_ERROR: 'Submitted data failed validation rules. Review your inputs.',
  JOB_LIFECYCLE_CONFLICT: 'This action cannot be applied in the current job state, or restart configuration is unavailable.',
  JOB_LIFECYCLE_FAILED: 'Failed to update job state. Job details were reloaded; review status before retrying.',
};

export function statusLabel(value: string, lang: Language = getActiveLanguage()): string {
  const key = String(value || '').toUpperCase();
  const table = lang === 'en' ? STATUS_LABELS_EN : STATUS_LABELS_ID;
  return table[key] || humanizeCode(value);
}

export function jobTypeLabel(value: string, lang: Language = getActiveLanguage()): string {
  const key = String(value || '').toUpperCase();
  const table = lang === 'en' ? JOB_TYPE_LABELS_EN : JOB_TYPE_LABELS_ID;
  return table[key] || humanizeCode(value);
}

export function processStepLabel(value: string | null | undefined, lang: Language = getActiveLanguage()): string {
  if (!value) return lang === 'en' ? 'Waiting for job updates' : 'Menunggu pembaruan proses';
  const key = value.toUpperCase().trim();
  const table = lang === 'en' ? STEP_LABELS_EN : STEP_LABELS_ID;
  return table[key] || humanizeCode(value);
}

export function actionLabel(value: string | null | undefined, lang: Language = getActiveLanguage()): string {
  if (!value) return '—';
  const key = value.toUpperCase();
  const actionsId: Record<string, string> = {
    ADMIN_LOGIN: 'Admin masuk', LOGIN: 'Admin masuk', ADMIN_LOGOUT: 'Admin keluar', LOGOUT: 'Admin keluar',
    DATASET_UPLOAD: 'Unggah Dataset', DATASET_VALIDATE: 'Validasi Dataset', DATASET_CREATE: 'Membuat Dataset',
    PARAMETER_SEARCH: 'Pencarian Parameter', FINAL_CLUSTERING: 'Klasterisasi Final',
    RUN_ACTIVATE: 'Mengaktifkan Run', ACTIVATE_RUN: 'Mengaktifkan Run', RUN_DEACTIVATE: 'Menonaktifkan Run',
    JOB_PAUSE: 'Jeda Proses', JOB_RESUME: 'Lanjutkan Proses', JOB_STOP: 'Hentikan Proses',
    JOB_CANCEL: 'Batalkan Proses', JOB_RESTART: 'Mulai Ulang Proses',
  };
  const actionsEn: Record<string, string> = {
    ADMIN_LOGIN: 'Admin Login', LOGIN: 'Admin Login', ADMIN_LOGOUT: 'Admin Logout', LOGOUT: 'Admin Logout',
    DATASET_UPLOAD: 'Upload Dataset', DATASET_VALIDATE: 'Validate Dataset', DATASET_CREATE: 'Create Dataset',
    PARAMETER_SEARCH: 'Parameter Search', FINAL_CLUSTERING: 'Final Clustering',
    RUN_ACTIVATE: 'Activate Run', ACTIVATE_RUN: 'Activate Run', RUN_DEACTIVATE: 'Deactivate Run',
    JOB_PAUSE: 'Pause Job', JOB_RESUME: 'Resume Job', JOB_STOP: 'Stop Job',
    JOB_CANCEL: 'Cancel Job', JOB_RESTART: 'Restart Job',
  };
  return (lang === 'en' ? actionsEn : actionsId)[key] || humanizeCode(value);
}

export function fieldLabel(value: string, lang: Language = getActiveLanguage()): string {
  const table = lang === 'en' ? FIELD_LABELS_EN : FIELD_LABELS_ID;
  return table[value] || humanizeCode(value);
}

export function humanizeCode(value: string): string {
  if (!value) return '—';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function friendlyErrorMessage(
  message: string,
  code?: string,
  status?: number,
  lang: Language = getActiveLanguage(),
): string {
  const errorLabels = lang === 'en' ? ERROR_LABELS_EN : ERROR_LABELS_ID;
  if (code && errorLabels[code]) return errorLabels[code];
  const raw = String(message || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw) {
    return lang === 'en'
      ? 'An unexpected issue occurred. Please try again.'
      : 'Terjadi kendala yang belum dapat dijelaskan. Silakan coba lagi.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed|connection refused|tidak dapat terhubung ke server/.test(normalized)) return errorLabels.NETWORK_ERROR;
  if (/belum ada hasil dbscan aktif/.test(normalized)) {
    return lang === 'en'
      ? 'No active DBSCAN run has been published yet. WebGIS will display results after an administrator activates a successful run.'
      : raw;
  }
  if (/format data dari server tidak sesuai/.test(normalized)) return errorLabels.INVALID_RESPONSE;
  if (/sesi administrator telah berakhir/.test(normalized)) return errorLabels.UNAUTHORIZED;
  if (/terjadi kesalahan\.?$/.test(normalized)) {
    return lang === 'en' ? 'An unexpected error occurred.' : raw;
  }
  if (/tidak dapat memuat status proses/.test(normalized)) {
    return lang === 'en' ? 'Unable to load job status.' : raw;
  }
  if (/catatan aktivitas belum dapat ditampilkan/.test(normalized)) {
    return lang === 'en'
      ? 'Activity logs cannot be displayed because the server response format was unexpected. Try again or contact an administrator.'
      : raw;
  }
  if (/daftar proses (tidak dapat dibaca|dari server belum dapat ditampilkan)/.test(normalized)) {
    return lang === 'en'
      ? 'Unable to read the job list from the server. Reload the page or try again.'
      : raw;
  }
  const httpMatch = raw.match(/^Permintaan gagal \(HTTP (\d+)\)\.?$/i);
  if (httpMatch) {
    return lang === 'en' ? `Request failed (HTTP ${httpMatch[1]}).` : raw;
  }
  if (/artefak analisis belum tersedia/.test(normalized)) {
    return lang === 'en'
      ? 'Analysis artifacts are not available for this job. Legacy jobs created before the Elbow feature have no stored curves.'
      : raw;
  }
  if (/ringkasan analisis( k-distance)? gagal dimuat/.test(normalized)) {
    return lang === 'en' ? 'Failed to load k-Distance analysis summary.' : raw;
  }
  if (/timed? ?out|timeout/.test(normalized)) {
    return lang === 'en'
      ? 'The request timed out. Please try again.'
      : 'Permintaan membutuhkan waktu terlalu lama. Silakan coba lagi.';
  }
  if (/invalid credentials|incorrect password|bad username|invalid username/.test(normalized)) return errorLabels.INVALID_CREDENTIALS;
  if (/experiment.*not found/.test(normalized)) return errorLabels.EXPERIMENT_NOT_FOUND;
  if (/dataset.*not ready/.test(normalized)) return errorLabels.DATASET_NOT_READY;
  if (/no valid experiment/.test(normalized)) return errorLabels.NO_VALID_EXPERIMENTS;
  if (/missing.*csrf|csrf.*missing/.test(normalized)) return errorLabels.CSRF_COOKIE_MISSING;
  if (/unauthorized|missing.*access token|missing.*cookie|token has expired/.test(normalized) || status === 401) return errorLabels.UNAUTHORIZED;
  if (/forbidden|permission denied/.test(normalized) || status === 403) return errorLabels.FORBIDDEN;
  if (/not found|requested url was not found/.test(normalized) || status === 404) return errorLabels.NOT_FOUND;
  if (status === 422) {
    return lang === 'en'
      ? 'Input failed validation rules. Review your values.'
      : 'Data belum memenuhi aturan pemeriksaan. Periksa kembali isian Anda.';
  }
  if (status === 400) {
    return lang === 'en'
      ? 'The request could not be processed. Review submitted data.'
      : 'Permintaan tidak dapat diproses. Periksa kembali data yang dikirim.';
  }
  if (/internal server error|something went wrong/.test(normalized) || (status !== undefined && status >= 500)) return errorLabels.INTERNAL_SERVER_ERROR;
  if (/job_already_running/.test(normalized)) return errorLabels.JOB_ALREADY_RUNNING;
  if (/job_failed/.test(normalized)) return errorLabels.JOB_FAILED;
  if (/invalid.*(payload|request|field)|validation error/.test(normalized)) return errorLabels.VALIDATION_ERROR;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(raw)) return humanizeCode(raw);
  return raw;
}

export function displayValue(
  value: unknown,
  key = '',
  lang: Language = getActiveLanguage(),
): string {
  if (value === null || value === undefined || value === '') {
    return lang === 'en' ? 'Not available' : 'Tidak tersedia';
  }
  if (typeof value === 'boolean') {
    return value ? (lang === 'en' ? 'Yes' : 'Ya') : (lang === 'en' ? 'No' : 'Tidak');
  }
  if (typeof value === 'number') {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' && item !== null ? (lang === 'en' ? 'Details available' : 'Rincian tersedia') : String(item)))
      .join(', ') || (lang === 'en' ? 'None' : 'Tidak ada');
  }
  if (typeof value === 'object') {
    const count = Object.keys(value as Record<string, unknown>).length;
    return lang === 'en' ? `${count} details available` : `${count} rincian tersedia`;
  }
  const text = String(value);
  if (key === 'status') return statusLabel(text, lang);
  if (key === 'job_type') return jobTypeLabel(text, lang);
  if (key === 'action') return actionLabel(text, lang);
  if (key === 'entity_type') {
    const entitiesId: Record<string, string> = { dataset: 'Dataset', run: 'Eksekusi', user: 'Pengguna', job: 'Proses' };
    const entitiesEn: Record<string, string> = { dataset: 'Dataset', run: 'Run', user: 'User', job: 'Job' };
    return (lang === 'en' ? entitiesEn : entitiesId)[text.toLowerCase()] || humanizeCode(text);
  }
  if (key === 'current_step') return processStepLabel(text, lang);
  if (key.endsWith('_at')) return formatDateTime(text, lang);
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) return humanizeCode(text);
  return text;
}

function formatDateTime(value: string, lang: Language = getActiveLanguage()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function extractYear(value?: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getUTCFullYear();
}

export function formatDatasetYearRange(
  dataset?: { start_date?: string | null; end_date?: string | null } | null,
): string | null {
  const startYear = extractYear(dataset?.start_date);
  const endYear = extractYear(dataset?.end_date);
  if (startYear === null || endYear === null) return null;
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}
