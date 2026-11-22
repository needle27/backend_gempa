import { API_BASE_URL, IS_PREVIEW_MODE } from '../config/env';
import { apiRequest, apiRequestEnvelope } from './client';
import { ApiError } from '../types/api';
import { friendlyErrorMessage } from '../utils/presentation';
import type {
  AdminDetailRecord, AuditLogRecord, AuditLogResult, ClusterProfile, DatasetItem, JobListResult,
  DatasetValidationResult, DBSCANRun, ParameterExperiment, ProcessingJob,
  PublicMetadata, PublicSummary, RealtimeEarthquake, RealtimeFeed,
  ResearchEarthquake, UploadResult,
} from '../types/domain';

function assertLiveMutation(): void {
  if (IS_PREVIEW_MODE) throw new Error('Operasi dinonaktifkan pada Mode Pratinjau.');
}

export async function getPublicMetadata(): Promise<PublicMetadata> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/public')).previewMetadata;
  try { return await apiRequest<PublicMetadata>('/api/metadata'); }
  catch (error) { if (error instanceof ApiError && error.code === 'NO_ACTIVE_RUN') return { dataset: null, run: null }; throw error; }
}

export async function getPublicSummary(): Promise<PublicSummary | null> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/public')).previewSummary;
  try { return await apiRequest<PublicSummary>('/api/summary'); }
  catch (error) { if (error instanceof ApiError && error.code === 'NO_ACTIVE_RUN') return null; throw error; }
}

export async function getClusterProfiles(): Promise<ClusterProfile[]> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/public')).previewProfiles;
  try { return await apiRequest<ClusterProfile[]>('/api/profil'); }
  catch (error) { if (error instanceof ApiError && error.code === 'NO_ACTIVE_RUN') return []; throw error; }
}

export async function getResearchEarthquakes(page = 1, limit = 1000): Promise<ResearchEarthquake[]> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/public')).previewEarthquakes;
  try {
    const result = await apiRequestEnvelope<ResearchEarthquake[]>(`/api/gempa?page=${page}&limit=${limit}`);
    return result.data;
  } catch (error) { if (error instanceof ApiError && error.code === 'NO_ACTIVE_RUN') return []; throw error; }
}

export async function getRealtimeFeed(category: 'latest' | 'm5' | 'felt') {
  if (IS_PREVIEW_MODE) {
    const fixtures = await import('../mocks/realtime');
    return fixtures.previewRealtime[category] as RealtimeFeed<RealtimeEarthquake>;
  }
  return apiRequest<RealtimeFeed<RealtimeEarthquake>>(`/api/realtime/${category}`);
}

export async function getDatasets(page = 1, limit = 20, status?: string): Promise<DatasetItem[]> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/admin')).previewDatasets;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  const result = await apiRequestEnvelope<DatasetItem[]>(`/api/admin/datasets?${params.toString()}`);
  return result.data;
}

export async function getDatasetDetail(datasetId: number): Promise<AdminDetailRecord> {
  if (IS_PREVIEW_MODE) {
    const item = (await import('../mocks/admin')).previewDatasets.find((dataset) => dataset.id === datasetId);
    return item ? { ...item } : {};
  }
  return apiRequest<AdminDetailRecord>(`/api/admin/datasets/${datasetId}`);
}

export async function validateDataset(file: File): Promise<DatasetValidationResult> {
  assertLiveMutation();
  const form = new FormData();
  form.append('file', file);
  return apiRequest<DatasetValidationResult>('/api/admin/datasets/validate', { method: 'POST', body: form });
}

export async function uploadDataset(input: {
  file: File; datasetName: string; sourceName: string; sourceUrl?: string; preprocessingVersion?: string;
}): Promise<UploadResult> {
  assertLiveMutation();
  const form = new FormData();
  form.append('file', input.file);
  form.append('dataset_name', input.datasetName);
  form.append('source_name', input.sourceName);
  if (input.sourceUrl) form.append('source_url', input.sourceUrl);
  if (input.preprocessingVersion) form.append('preprocessing_version', input.preprocessingVersion);
  return apiRequest<UploadResult>('/api/admin/datasets', { method: 'POST', body: form });
}

export async function startParameterSearch(
  datasetId: number,
  minSamples: number[],
  sensitivity?: number[],
  epsCandidatesKm?: number[] | null,
  useDefaultGrid = true,
) {
  assertLiveMutation();
  const body: Record<string, unknown> = {
    min_samples_candidates: minSamples,
    sensitivity_percentages: sensitivity ?? [],
    eps_candidates_km: epsCandidatesKm?.length ? epsCandidatesKm : null,
    use_default_grid: useDefaultGrid,
  };
  return apiRequest<{ job_id: number; task_id?: string; status: string; job_type?: string }>(`/api/admin/datasets/${datasetId}/parameter-search`, {
    method: 'POST', body: JSON.stringify(body),
  });
}

export interface JobListFilters {
  page?: number;
  limit?: number;
  status?: string;
  job_type?: string;
  dataset_id?: number;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function firstBoolean(...values: unknown[]): boolean | null {
  return values.find((value): value is boolean => typeof value === 'boolean') ?? null;
}

function extractJobRows(data: unknown): ProcessingJob[] {
  if (Array.isArray(data)) return data as ProcessingJob[];
  const record = recordOf(data);
  if (!record) throw new Error('Daftar proses tidak dapat dibaca. Muat ulang halaman atau coba lagi.');
  for (const key of ['items', 'jobs', 'results', 'data']) {
    if (Array.isArray(record[key])) return record[key] as ProcessingJob[];
  }
  throw new Error('Daftar proses dari server belum dapat ditampilkan. Silakan coba lagi atau hubungi administrator.');
}

export async function getJobs(filters: JobListFilters = {}): Promise<JobListResult> {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(filters.limit || 20)));

  if (IS_PREVIEW_MODE) {
    const fixtures = (await import('../mocks/admin')).previewJobs;
    const filtered = fixtures.filter((job) =>
      (!filters.status || job.status === filters.status) &&
      (!filters.job_type || job.job_type === filters.job_type) &&
      (!filters.dataset_id || job.dataset_id === filters.dataset_id),
    );
    const offset = (page - 1) * limit;
    const items = filtered.slice(offset, offset + limit);
    return { items, total: filtered.length, page, limit, offset, hasMore: offset + items.length < filtered.length };
  }

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) params.set('status', filters.status);
  if (filters.job_type) params.set('job_type', filters.job_type);
  if (filters.dataset_id) params.set('dataset_id', String(filters.dataset_id));

  const response = await apiRequestEnvelope<unknown>(`/api/admin/jobs?${params.toString()}`);
  const items = extractJobRows(response.data);
  const dataRecord = recordOf(response.data);
  const metaRecord = response.meta as unknown as Record<string, unknown>;
  const pagination = recordOf(metaRecord.pagination) ?? recordOf(dataRecord?.pagination) ?? {};
  const total = firstNumber(metaRecord.count, metaRecord.total, metaRecord.total_count, pagination.total, pagination.total_count, pagination.count, dataRecord?.total, dataRecord?.total_count);
  const actualPage = firstNumber(metaRecord.page, pagination.page, dataRecord?.page) ?? page;
  const actualLimit = firstNumber(metaRecord.limit, pagination.limit, dataRecord?.limit) ?? limit;
  const offset = firstNumber(metaRecord.offset, pagination.offset, dataRecord?.offset) ?? (actualPage - 1) * actualLimit;
  const explicitHasMore = firstBoolean(metaRecord.has_more, metaRecord.has_next, pagination.has_more, pagination.has_next, dataRecord?.has_more, dataRecord?.has_next);
  const hasMore = explicitHasMore ?? (total !== null ? offset + items.length < total : items.length >= actualLimit);

  return { items, total, page: actualPage, limit: actualLimit, offset, hasMore };
}

export async function getJob(jobId: number): Promise<ProcessingJob> {
  if (IS_PREVIEW_MODE) return { id: jobId, dataset_id: 1, run_id: null, job_type: 'PARAMETER_SEARCH', status: 'SUCCESS', progress: 100, current_step: 'PREPARING', message: 'Ini adalah status simulasi untuk memeriksa tampilan. Tidak ada proses yang dijalankan.', error_code: null, created_at: null, started_at: null, finished_at: null };
  return apiRequest<ProcessingJob>(`/api/admin/jobs/${jobId}`);
}

export type JobLifecycleAction = 'pause' | 'resume' | 'stop';

export interface RestartJobResult {
  id: number;
  parent_job_id: number;
  status?: string;
}

/** Mengirim perubahan status tanpa request body; client menangani cookie JWT dan CSRF. */
export async function updateJobLifecycle(jobId: number, action: JobLifecycleAction): Promise<unknown> {
  assertLiveMutation();
  return apiRequest<unknown>(`/api/admin/jobs/${jobId}/${action}`, { method: 'POST' });
}

/** Restart selalu membuat Job baru dan mengembalikan ID Job turunan. */
export async function restartJob(jobId: number): Promise<RestartJobResult> {
  assertLiveMutation();
  return apiRequest<RestartJobResult>(`/api/admin/jobs/${jobId}/restart`, { method: 'POST' });
}

export async function getExperiments(jobId: number): Promise<ParameterExperiment[]> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/admin')).previewExperiments;
  return apiRequest<ParameterExperiment[]>(`/api/admin/jobs/${jobId}/experiments`);
}



export interface ElbowCurveSummary {
  min_samples: number;
  point_count: number;
  knee_detected: boolean;
  epsilon_km: number | null;
  detail_url: string;
  plot_url: string;
  data_url: string;
  metadata_url: string;
}

export interface ElbowSummary {
  job_id: number;
  dataset_id: number;
  job_status: string;
  ready: boolean;
  metric: string;
  distance_unit: string;
  curves: ElbowCurveSummary[];
  comparison_plot_url: string | null;
}

export type ElbowDetailRecord = Record<string, unknown>;

function requiredText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeApiPath(value: string): string {
  const resolved = new URL(value, `${API_BASE_URL}/`);
  if (resolved.origin !== new URL(API_BASE_URL).origin) {
    throw new Error('Tautan analisis dari server tidak berasal dari API SEISMAP.');
  }
  return `${resolved.pathname}${resolved.search}`;
}

export async function getElbowSummary(jobId: number): Promise<ElbowSummary> {
  if (IS_PREVIEW_MODE) throw new Error('Analisis K-Distance hanya tersedia pada koneksi backend aktif.');
  const raw = await apiRequest<unknown>(`/api/admin/jobs/${jobId}/elbow`);
  const record = recordOf(raw);
  if (!record || !Array.isArray(record.curves)) {
    throw new Error('Ringkasan analisis K-Distance dari server belum sesuai format.');
  }

  const curves = record.curves.flatMap((item): ElbowCurveSummary[] => {
    const curve = recordOf(item);
    if (!curve) return [];
    const minSamples = firstNumber(curve.min_samples);
    if (minSamples === null) return [];
    return [{
      min_samples: minSamples,
      point_count: firstNumber(curve.point_count) ?? 0,
      knee_detected: firstBoolean(curve.knee_detected) ?? false,
      epsilon_km: firstNumber(curve.epsilon_km),
      detail_url: requiredText(curve.detail_url),
      plot_url: requiredText(curve.plot_url),
      data_url: requiredText(curve.data_url),
      metadata_url: requiredText(curve.metadata_url),
    }];
  });

  return {
    job_id: firstNumber(record.job_id) ?? jobId,
    dataset_id: firstNumber(record.dataset_id) ?? 0,
    job_status: requiredText(record.job_status),
    ready: firstBoolean(record.ready) ?? false,
    metric: requiredText(record.metric, 'haversine'),
    distance_unit: requiredText(record.distance_unit, 'km'),
    curves,
    comparison_plot_url: typeof record.comparison_plot_url === 'string' ? record.comparison_plot_url : null,
  };
}

export async function getElbowDetail(detailUrl: string): Promise<ElbowDetailRecord> {
  if (IS_PREVIEW_MODE) throw new Error('Rincian analisis tidak tersedia pada Mode Pratinjau.');
  const raw = await apiRequest<unknown>(normalizeApiPath(detailUrl));
  const record = recordOf(raw);
  if (!record) throw new Error('Rincian kurva dari server belum sesuai format.');
  return record;
}

export async function fetchElbowArtifact(artifactUrl: string): Promise<Blob> {
  if (IS_PREVIEW_MODE) throw new Error('Unduhan artefak tidak tersedia pada Mode Pratinjau.');
  const target = new URL(artifactUrl, `${API_BASE_URL}/`);
  if (target.origin !== new URL(API_BASE_URL).origin) {
    throw new Error('Tautan unduhan tidak berasal dari server SEISMAP.');
  }

  const request = () => fetch(target.toString(), { method: 'GET', credentials: 'include' });
  let response = await request();
  if (response.status === 401) {
    try {
      await apiRequestEnvelope<unknown>('/api/auth/refresh', { method: 'POST', csrf: 'refresh' });
      response = await request();
    } catch {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('seismap:auth-expired'));
      throw new ApiError('Sesi administrator telah berakhir. Silakan masuk kembali.', 401, 'UNAUTHORIZED');
    }
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seismap:auth-expired'));
  }
  if (!response.ok) {
    let body: unknown = null;
    try { body = await response.json(); } catch { /* Respons unduhan dapat berupa teks biasa. */ }
    const envelope = recordOf(body);
    const meta = recordOf(envelope?.meta);
    const message = requiredText(meta?.message, `Unduhan artefak gagal (HTTP ${response.status}).`);
    const code = requiredText(meta?.code, 'ARTIFACT_DOWNLOAD_FAILED');
    throw new ApiError(friendlyErrorMessage(message, code, response.status), response.status, code, recordOf(meta?.details));
  }
  return response.blob();
}

export async function startFinalDbscan(datasetId: number, experimentId: number) {
  assertLiveMutation();
  return apiRequest<{ job_id: number; run_id: number; task_id?: string; status: string }>(`/api/admin/datasets/${datasetId}/runs`, {
    method: 'POST',
    body: JSON.stringify({ experiment_id: experimentId }),
  });
}

export async function getRuns(datasetId: number): Promise<DBSCANRun[]> {
  if (IS_PREVIEW_MODE) return (await import('../mocks/admin')).previewRuns;
  return apiRequest<DBSCANRun[]>(`/api/admin/datasets/${datasetId}/runs`);
}

export async function getRunDetail(runId: number): Promise<AdminDetailRecord> {
  if (IS_PREVIEW_MODE) {
    const item = (await import('../mocks/admin')).previewRuns.find((run) => run.id === runId);
    return item ? { ...item } : {};
  }
  return apiRequest<AdminDetailRecord>(`/api/admin/runs/${runId}`);
}

export async function activateRun(runId: number): Promise<unknown> {
  assertLiveMutation();
  return apiRequest<unknown>(`/api/admin/runs/${runId}/activate`, { method: 'POST' });
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  created_after?: string;
  created_before?: string;
  q?: string;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResult> {
  if (IS_PREVIEW_MODE) return { items: [], count: 0, limit: filters.limit || 50, offset: ((filters.page || 1) - 1) * (filters.limit || 50) };
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(1, filters.limit || 50));
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  (['action', 'entity_type', 'entity_id', 'user_id', 'created_after', 'created_before', 'q'] as const).forEach((key) => {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  });
  const result = await apiRequestEnvelope<AuditLogRecord[]>(`/api/admin/audit-logs?${params.toString()}`);
  if (!Array.isArray(result.data)) {
    throw new Error('Catatan aktivitas belum dapat ditampilkan karena format data dari server belum sesuai. Silakan coba lagi atau hubungi administrator.');
  }
  const items = result.data;
  return {
    items,
    count: result.meta.count ?? items.length,
    limit: result.meta.limit ?? limit,
    offset: result.meta.offset ?? (page - 1) * limit,
  };
}
