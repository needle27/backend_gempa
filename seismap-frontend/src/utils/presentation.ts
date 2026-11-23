const STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Berhasil', READY: 'Siap digunakan', PROCESSED: 'Sudah diproses', ACTIVE: 'Aktif',
  VALID: 'Valid', RECOMMENDED: 'Direkomendasikan', FAILED: 'Gagal', CANCELLED: 'Dibatalkan',
  ERROR: 'Kesalahan', INVALID: 'Tidak valid', RUNNING: 'Sedang berjalan', QUEUED: 'Dalam antrean',
  PAUSE_REQUESTED: 'Sedang menjeda', PAUSED: 'Dijeda', STOP_REQUESTED: 'Sedang menghentikan',
  CLUSTERING: 'Sedang membentuk klaster', DRAFT: 'Draf', ARCHIVED: 'Diarsipkan', STALE: 'Data tersimpan sementara',
  HIT: 'Tersedia di cache', MISS: 'Diambil dari sumber', PROCESSING: 'Sedang diproses', PENDING: 'Menunggu',
  UPLOADING: 'Sedang diunggah', VALIDATING: 'Sedang diperiksa', REJECTED: 'Ditolak', AVAILABLE: 'Tersedia', NO_ACTIVE_RUN: 'Belum ada hasil aktif',
  NO_VALID_EXPERIMENT: 'Tidak ada eksperimen valid', HISTORIS: 'Data historis',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  PARAMETER_SEARCH: 'Pencarian Parameter',
  FINAL_CLUSTERING: 'Klasterisasi Final',
};

const STEP_LABELS: Record<string, string> = {
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

const FIELD_LABELS: Record<string, string> = {
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
};

const INVALID_REASON_LABELS: Record<string, string> = {
  CLUSTER_COUNT_BELOW_MINIMUM: 'Jumlah klaster di bawah batas minimum',
  CLUSTER_COUNT_ABOVE_MAXIMUM: 'Jumlah klaster melebihi batas maksimum',
  NOISE_PERCENTAGE_ABOVE_MAXIMUM: 'Persentase noise melebihi ambang batas maksimum',
  NOISE_PERCENTAGE_UNAVAILABLE: 'Persentase noise tidak tersedia',
  LARGEST_CLUSTER_RATIO_ABOVE_MAXIMUM: 'Dominasi klaster terbesar terlalu tinggi',
  LARGEST_CLUSTER_RATIO_UNAVAILABLE: 'Rasio klaster terbesar tidak tersedia',
  // Variasi kode lama / deskriptif
  min_clusters_not_met: 'Jumlah klaster di bawah batas minimum',
  max_clusters_exceeded: 'Jumlah klaster melebihi batas maksimum',
  noise_percentage_exceeds_max: 'Persentase noise melebihi ambang batas maksimum',
  largest_cluster_ratio_exceeds_max: 'Dominasi klaster terbesar terlalu tinggi',
};

export function formatInvalidReason(reason: string): string {
  if (!reason) return '—';
  const trimmed = reason.trim();
  // Cek apakah ada detail dalam kurung, misal: "NOISE_PERCENTAGE_ABOVE_MAXIMUM (74.9% > 40.0%)"
  const match = trimmed.match(/^([A-Za-z0-9_]+)(?:\s*\((.*)\))?$/);
  if (match) {
    const [, code, details] = match;
    const baseLabel =
      INVALID_REASON_LABELS[code] ||
      INVALID_REASON_LABELS[code.toUpperCase()] ||
      humanizeCode(code);
    return details ? `${baseLabel} (${details})` : baseLabel;
  }
  return INVALID_REASON_LABELS[trimmed] || trimmed;
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

const ERROR_LABELS: Record<string, string> = {
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
  JOB_LIFECYCLE_FAILED: 'Backend gagal memproses perubahan status. Rincian proses telah dimuat ulang; periksa status sebelum mencoba kembali.',
};

export function statusLabel(value: string): string {
  const key = String(value || '').toUpperCase();
  return STATUS_LABELS[key] || humanizeCode(value);
}

export function jobTypeLabel(value: string): string {
  const key = String(value || '').toUpperCase();
  return JOB_TYPE_LABELS[key] || humanizeCode(value);
}

export function processStepLabel(value: string | null | undefined): string {
  if (!value) return 'Menunggu pembaruan proses';
  const key = value.toUpperCase().trim();
  return STEP_LABELS[key] || humanizeCode(value);
}

export function actionLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const key = value.toUpperCase();
  const actions: Record<string, string> = {
    ADMIN_LOGIN: 'Admin masuk', ADMIN_LOGOUT: 'Admin keluar', DATASET_UPLOAD: 'Unggah Dataset',
    DATASET_VALIDATE: 'Validasi Dataset', DATASET_CREATE: 'Membuat Dataset', PARAMETER_SEARCH: 'Pencarian Parameter',
    FINAL_CLUSTERING: 'Klasterisasi Final', RUN_ACTIVATE: 'Mengaktifkan Run', RUN_DEACTIVATE: 'Menonaktifkan Run',
  };
  return actions[key] || humanizeCode(value);
}

export function fieldLabel(value: string): string {
  return FIELD_LABELS[value] || humanizeCode(value);
}

export function humanizeCode(value: string): string {
  if (!value) return '—';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function friendlyErrorMessage(message: string, code?: string, status?: number): string {
  if (code && ERROR_LABELS[code]) return ERROR_LABELS[code];
  const raw = String(message || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw) return 'Terjadi kendala yang belum dapat dijelaskan. Silakan coba lagi.';
  if (/failed to fetch|networkerror|network request failed|load failed|connection refused/.test(normalized)) return ERROR_LABELS.NETWORK_ERROR;
  if (/timed? ?out|timeout/.test(normalized)) return 'Permintaan membutuhkan waktu terlalu lama. Silakan coba lagi.';
  if (/invalid credentials|incorrect password|bad username|invalid username/.test(normalized)) return ERROR_LABELS.INVALID_CREDENTIALS;
  if (/experiment.*not found/.test(normalized)) return ERROR_LABELS.EXPERIMENT_NOT_FOUND;
  if (/dataset.*not ready/.test(normalized)) return ERROR_LABELS.DATASET_NOT_READY;
  if (/no valid experiment/.test(normalized)) return ERROR_LABELS.NO_VALID_EXPERIMENTS;
  if (/missing.*csrf|csrf.*missing/.test(normalized)) return ERROR_LABELS.CSRF_COOKIE_MISSING;
  if (/unauthorized|missing.*access token|missing.*cookie|token has expired/.test(normalized) || status === 401) return ERROR_LABELS.UNAUTHORIZED;
  if (/forbidden|permission denied/.test(normalized) || status === 403) return ERROR_LABELS.FORBIDDEN;
  if (/not found|requested url was not found/.test(normalized) || status === 404) return ERROR_LABELS.NOT_FOUND;
  if (status === 422) return 'Data belum memenuhi aturan pemeriksaan. Periksa kembali isian Anda.';
  if (status === 400) return 'Permintaan tidak dapat diproses. Periksa kembali data yang dikirim.';
  if (/internal server error|something went wrong/.test(normalized) || (status !== undefined && status >= 500)) return ERROR_LABELS.INTERNAL_SERVER_ERROR;
  if (/job_already_running/.test(normalized)) return ERROR_LABELS.JOB_ALREADY_RUNNING;
  if (/job_failed/.test(normalized)) return ERROR_LABELS.JOB_FAILED;
  if (/invalid.*(payload|request|field)|validation error/.test(normalized)) return ERROR_LABELS.VALIDATION_ERROR;
  // Preserve an already Indonesian explanation, but do not expose opaque machine codes alone.
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(raw)) return humanizeCode(raw);
  return raw;
}

export function displayValue(value: unknown, key = ''): string {
  if (value === null || value === undefined || value === '') return 'Tidak tersedia';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'number') return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value);
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' && item !== null ? 'Rincian tersedia' : String(item)).join(', ') || 'Tidak ada';
  if (typeof value === 'object') return `${Object.keys(value as Record<string, unknown>).length} rincian tersedia`;
  const text = String(value);
  if (key === 'status') return statusLabel(text);
  if (key === 'job_type') return jobTypeLabel(text);
  if (key === 'action') return actionLabel(text);
  if (key === 'entity_type') { const entities: Record<string, string> = { dataset: 'Dataset', run: 'Eksekusi', user: 'Pengguna', job: 'Proses' }; return entities[text.toLowerCase()] || humanizeCode(text); }
  if (key === 'current_step') return processStepLabel(text);
  if (key.endsWith('_at')) return formatDateTime(text);
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) return humanizeCode(text);
  return text;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
