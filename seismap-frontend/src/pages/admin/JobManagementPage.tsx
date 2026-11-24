import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, Database, Filter, ListTodo,
  RefreshCw, Search, Workflow, XCircle,
} from 'lucide-react';
import { getDatasets, getExperiments, getJobs, type JobListFilters } from '../../api/services';
import { usePipeline } from '../../context/PipelineContext';
import { JobLifecycleControls } from '../../components/JobLifecycleControls';
import { useJobPolling } from '../../hooks/useJobPolling';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import {
  GlassCard, PageHeader, SimulationTag, StatePanel, StatusBadge, StatCard,
  formatDate, formatNumber,
} from '../../components/ui';
import {
  friendlyErrorMessage, jobTypeLabel, processStepLabel,
  formatPercent, formatRatioPercent, formatInvalidReason,
} from '../../utils/presentation';
import type { ParameterExperiment, ProcessingJob } from '../../types/domain';

const DEFAULT_LIMIT = 20;
const NON_TERMINAL_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'STOP_REQUESTED']);
const POLLING_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'STOP_REQUESTED']);

function isActive(job: ProcessingJob): boolean {
  return NON_TERMINAL_STATUSES.has(job.status);
}

export function JobManagementPage() {
  const { lang, tx } = useI18n();
  const navigate = useNavigate();
  const { setSelectedDatasetId, setParameterJobId } = usePipeline();
  const datasets = useResource(() => getDatasets(1, 100), []);
  const datasetNames = useMemo(() => new Map((datasets.data || []).map((dataset) => [dataset.id, dataset.dataset_name] as const)), [datasets.data]);

  const [draft, setDraft] = useState({ status: '', job_type: '', dataset_id: '' });
  const [filters, setFilters] = useState<JobListFilters>({ page: 1, limit: DEFAULT_LIMIT });
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof getJobs>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [experiments, setExperiments] = useState<ParameterExperiment[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentsError, setExperimentsError] = useState<string | null>(null);

  const queryKey = useMemo(() => JSON.stringify({ ...filters, page }), [filters, page]);
  const prevQueryKey = useRef(queryKey);

  useEffect(() => {
    let active = true;
    const isFilterChange = prevQueryKey.current !== queryKey;
    prevQueryKey.current = queryKey;

    // Hanya tampilkan state loading jika data belum ada atau filter/halaman berubah
    // Jangan kedip saat silent polling periodik
    if (isFilterChange || !jobs) {
      setLoading(true);
    }
    setError(null);
    getJobs({ ...filters, page }).then((result) => {
      if (active) setJobs(result);
    }).catch((reason: unknown) => {
      if (active && (isFilterChange || !jobs)) {
        setError(reason instanceof Error ? reason.message : tx('Daftar proses gagal dimuat.', 'Failed to load job list.'));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
    // queryKey represents all server-side filters and pagination values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, refreshKey]);

  const hasPollingJobs = Boolean(jobs?.items.some((job) => POLLING_STATUSES.has(job.status)));
  useEffect(() => {
    if (!hasPollingJobs) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        setRefreshKey((value) => value + 1);
      }
    };
    const timer = window.setInterval(refreshWhenVisible, 5000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [hasPollingJobs]);

  const selectedJobState = useJobPolling(selectedJobId);
  const selectedJob = selectedJobState.job;

  useEffect(() => {
    let active = true;
    if (!selectedJob || selectedJob.job_type !== 'PARAMETER_SEARCH' || selectedJob.status !== 'SUCCESS') {
      setExperiments([]);
      setExperimentsError(null);
      setExperimentsLoading(false);
      return;
    }
    setExperimentsLoading(true);
    setExperimentsError(null);
    getExperiments(selectedJob.id).then((items) => {
      if (active) setExperiments(items);
    }).catch((reason: unknown) => {
      if (active) setExperimentsError(reason instanceof Error ? reason.message : tx('Hasil eksperimen gagal dimuat.', 'Failed to load experiment results.'));
    }).finally(() => {
      if (active) setExperimentsLoading(false);
    });
    return () => { active = false; };
  }, [selectedJob?.id, selectedJob?.job_type, selectedJob?.status]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilterError(null);
    const datasetText = draft.dataset_id.trim();
    if (datasetText && (!/^\d+$/.test(datasetText) || Number(datasetText) < 1)) {
      setFilterError(tx('ID Dataset harus berupa integer positif.', 'Dataset ID must be a positive integer.'));
      return;
    }
    setPage(1);
    setFilters({
      page: 1,
      limit: jobs?.limit || DEFAULT_LIMIT,
      status: draft.status || undefined,
      job_type: draft.job_type || undefined,
      dataset_id: datasetText ? Number(datasetText) : undefined,
    });
  };

  const resetFilters = () => {
    setDraft({ status: '', job_type: '', dataset_id: '' });
    setFilterError(null);
    setPage(1);
    setFilters({ page: 1, limit: DEFAULT_LIMIT });
  };

  const selectJob = (jobId: number) => {
    setSelectedJobId(jobId);
    setExperiments([]);
    setExperimentsError(null);
  };

  const useJobForFinal = (job: ProcessingJob) => {
    setSelectedDatasetId(job.dataset_id);
    setParameterJobId(job.id);
    navigate('/admin/dbscan-final');
  };

  const useJobForElbow = (job: ProcessingJob) => {
    setSelectedDatasetId(job.dataset_id);
    setParameterJobId(job.id);
    navigate('/admin/parameter#elbow-analysis');
  };

  const total = jobs?.total;
  const totalPages = total === null || total === undefined ? null : Math.max(1, Math.ceil(total / (jobs?.limit || DEFAULT_LIMIT)));
  const activeOnPage = jobs?.items.filter(isActive).length || 0;
  const successOnPage = jobs?.items.filter((job) => job.status === 'SUCCESS').length || 0;
  const failedOnPage = jobs?.items.filter((job) => job.status === 'FAILED').length || 0;

  return <div className="page-stack">
    <PageHeader
      eyebrow={tx('ADMIN / PEMANTAUAN PROSES', 'ADMIN / JOB MONITORING')}
      title={tx('Manajemen Proses', 'Job Management')}
      description={tx('Pantau progres Pencarian Parameter dan DBSCAN Final, lalu buka kembali hasil eksperimen.', 'Monitor Parameter Search and Final DBSCAN progress, and revisit saved experiment outputs.')}
      action={<SimulationTag />}
    />

    <div className="stats-grid job-stats-grid">
      <StatCard label={tx('Total Proses', 'Total Jobs')} value={total === null || total === undefined ? '—' : formatNumber(total)} icon={<ListTodo size={17} />} tone="cyan" trend={tx('Sesuai filter aktif', 'Matching active filter')} />
      <StatCard label={tx('Belum selesai', 'In Progress')} value={formatNumber(activeOnPage)} icon={<Activity size={17} />} tone="amber" trend={tx('Termasuk proses yang dijeda', 'Includes paused jobs')} />
      <StatCard label={tx('Berhasil', 'Succeeded')} value={formatNumber(successOnPage)} icon={<CheckCircle2 size={17} />} tone="teal" trend={tx('Pada halaman ini', 'On this page')} />
      <StatCard label={tx('Gagal', 'Failed')} value={formatNumber(failedOnPage)} icon={<XCircle size={17} />} tone="violet" trend={tx('Pada halaman ini', 'On this page')} />
    </div>

    <GlassCard
      className="job-filter-card"
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> {tx('Filter Proses', 'Filter Jobs')}</span>}
      action={<button className="button button-secondary" type="button" onClick={resetFilters}>{tx('Reset Filter', 'Reset Filter')}</button>}
    >
      <form className="job-filter-grid" onSubmit={applyFilters}>
        <label>Status
          <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="">{tx('Semua status', 'All statuses')}</option>
            <option value="QUEUED">{tx('Dalam antrean', 'Queued')}</option><option value="RUNNING">{tx('Sedang berjalan', 'Running')}</option>
            <option value="PAUSE_REQUESTED">{tx('Sedang menjeda', 'Pause requested')}</option><option value="PAUSED">{tx('Dijeda', 'Paused')}</option><option value="STOP_REQUESTED">{tx('Sedang menghentikan', 'Stop requested')}</option><option value="SUCCESS">{tx('Berhasil', 'Success')}</option><option value="FAILED">{tx('Gagal', 'Failed')}</option><option value="CANCELLED">{tx('Dibatalkan', 'Cancelled')}</option>
          </select>
        </label>
        <label>{tx('Jenis proses', 'Job type')}
          <select value={draft.job_type} onChange={(event) => setDraft({ ...draft, job_type: event.target.value })}>
            <option value="">{tx('Semua jenis', 'All types')}</option><option value="PARAMETER_SEARCH">{tx('Pencarian Parameter', 'Parameter Search')}</option><option value="FINAL_CLUSTERING">{tx('Klasterisasi Final', 'Final Clustering')}</option>
          </select>
        </label>
        <label>{tx('ID Dataset', 'Dataset ID')}
          <input inputMode="numeric" value={draft.dataset_id} onChange={(event) => setDraft({ ...draft, dataset_id: event.target.value })} placeholder={tx('Contoh: 1', 'Example: 1')} />
        </label>
        <label>{tx('Jumlah per halaman', 'Rows per page')}
          <select value={filters.limit || DEFAULT_LIMIT} onChange={(event) => { const limit = Number(event.target.value); setPage(1); setFilters((current) => ({ ...current, page: 1, limit })); }}>
            <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
          </select>
        </label>
        {filterError && <div className="form-error job-filter-wide">{filterError}</div>}
        <div className="job-filter-actions job-filter-wide">
          <button className="button button-primary" type="submit"><Search size={15} /> {tx('Terapkan filter', 'Apply filter')}</button>
          <button className="button button-secondary" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={14} /> {tx('Muat ulang', 'Reload')}</button>
        </div>
      </form>
    </GlassCard>

    <GlassCard title={tx('Daftar Proses', 'Job List')}>
      {loading ? <StatePanel type="loading" title={tx('Memuat daftar proses', 'Loading jobs')} message={tx('Mengambil proses dan status terbaru.', 'Fetching jobs and latest statuses.')} />
        : error ? <StatePanel type="error" title={tx('Daftar proses belum tersedia', 'Jobs unavailable')} message={error} action={<button className="button button-secondary" onClick={() => setRefreshKey((value) => value + 1)}>{tx('Coba lagi', 'Try again')}</button>} />
          : !jobs?.items.length ? <StatePanel type="empty" title={tx('Proses tidak ditemukan', 'No jobs found')} message={tx('Tidak ada proses yang sesuai dengan filter. Hapus filter atau jalankan proses melalui halaman Pencarian Parameter atau DBSCAN Final.', 'No jobs match your filters. Reset filters or launch a run from Parameter Search or Final DBSCAN.')} />
            : <>
              <div className="job-list-meta"><span><strong>{total === null ? formatNumber(jobs.items.length) : formatNumber(total)}</strong> {tx('proses sesuai', 'matching jobs')}</span><span>{tx('Halaman', 'Page')} {page}{totalPages ? ` ${tx('dari', 'of')} ${totalPages}` : ''} · {formatNumber(jobs.items.length)} {tx('ditampilkan', 'shown')}</span></div>
              <div className="table-scroll"><table className="data-table job-table"><thead><tr><th>{tx('Proses', 'Job')}</th><th>{tx('Jenis proses', 'Job Type')}</th><th>Dataset</th><th>{tx('Kemajuan', 'Progress')}</th><th>Status</th><th>{tx('Dibuat', 'Created At')}</th><th /></tr></thead><tbody>
                {jobs.items.map((job) => <tr key={job.id} className={selectedJobId === job.id ? 'job-row-selected' : ''}>
                  <td><strong>#{job.id}</strong><small className="table-sub">{job.parent_job_id ? tx(`Lanjutan dari proses #${job.parent_job_id}`, `Restarted from job #${job.parent_job_id}`) : job.run_id ? `${tx('Eksekusi', 'Run')} #${job.run_id}` : `${tx('Proses', 'Job')} #${job.id}`}</small></td>
                  <td>{jobTypeLabel(job.job_type, lang)}</td>
                  <td><strong>{datasetNames.get(job.dataset_id) || `Dataset #${job.dataset_id}`}</strong><small className="table-sub">ID {job.dataset_id}</small></td>
                  <td><div className="job-table-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }} /></span><small>{formatNumber(job.progress || 0)}%</small></div></td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>{formatDate(job.created_at)}</td>
                  <td><button className="text-button" type="button" onClick={() => selectJob(job.id)}>{tx('Rincian', 'Details')} <ArrowRight size={13} /></button></td>
                </tr>)}
              </tbody></table></div>
              <div className="audit-pagination job-pagination">
                <span>{tx('Menampilkan', 'Showing')} {formatNumber((jobs.offset || 0) + 1)}–{formatNumber((jobs.offset || 0) + jobs.items.length)}{total !== null ? ` ${tx('dari', 'of')} ${formatNumber(total)}` : ''}</span>
                <div>
                  <button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>{tx('Sebelumnya', 'Previous')}</button>
                  <button className="button button-secondary" disabled={!jobs.hasMore || loading} onClick={() => setPage((value) => value + 1)}>{tx('Berikutnya', 'Next')}</button>
                </div>
              </div>
            </>}
    </GlassCard>

    {selectedJobId !== null && <GlassCard title={tx(`Rincian Proses #${selectedJobId}`, `Job #${selectedJobId} Details`)} subtitle={tx('Informasi status proses yang dipilih.', 'Status summary for the selected job.')} action={<button className="button button-ghost" type="button" onClick={() => setSelectedJobId(null)}>{tx('Tutup', 'Close')}</button>}>
      {selectedJobState.error ? <StatePanel type="error" title={tx('Rincian proses gagal dimuat', 'Failed to load job details')} message={selectedJobState.error} />
        : !selectedJob ? <StatePanel type="loading" title={tx('Memuat rincian proses', 'Loading job details')} message={tx('Mengambil status, kemajuan, dan informasi proses.', 'Fetching status, progress, and job metadata.')} />
          : <div className="job-detail-layout">
            <div className="job-detail-main">
              <div className="job-detail-heading"><div><span className="eyebrow">{jobTypeLabel(selectedJob.job_type, lang)}</span><h3>{tx('Proses', 'Job')} #{selectedJob.id}</h3></div><StatusBadge status={selectedJob.status} /></div>
              <div className="job-detail-progress"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, selectedJob.progress || 0))}%` }} /></div><div className="progress-label"><strong>{formatNumber(selectedJob.progress || 0)}%</strong><span>{selectedJob.current_step ? processStepLabel(selectedJob.current_step, lang) : selectedJob.message ? friendlyErrorMessage(selectedJob.message, undefined, undefined, lang) : tx('Menunggu pembaruan status', 'Waiting for status update')}</span></div></div>
              {selectedJob.message && <p className="job-detail-message">{friendlyErrorMessage(selectedJob.message, undefined, undefined, lang)}</p>}
              {selectedJob.error_code && <div className="form-error">{friendlyErrorMessage(selectedJob.error_code, undefined, undefined, lang)}</div>}
              <div className="job-detail-fields">
                <div><span>Dataset</span><strong>{datasetNames.get(selectedJob.dataset_id) || `#${selectedJob.dataset_id}`}</strong></div>
                <div><span>{tx('ID Eksekusi', 'Run ID')}</span><strong>{selectedJob.run_id ? `#${selectedJob.run_id}` : '—'}</strong></div>
                <div><span>{tx('Dibuat', 'Created')}</span><strong>{formatDate(selectedJob.created_at)}</strong></div>
                <div><span>{tx('Dimulai', 'Started')}</span><strong>{formatDate(selectedJob.started_at)}</strong></div>
                <div><span>{tx('Selesai', 'Finished')}</span><strong>{formatDate(selectedJob.finished_at)}</strong></div>
                {selectedJob.job_type === 'PARAMETER_SEARCH' && selectedJob.recommendation_status && (
                  <div>
                    <span>{tx('Status Rekomendasi', 'Recommendation Status')}</span>
                    <strong><StatusBadge status={selectedJob.recommendation_status} /></strong>
                  </div>
                )}
                {selectedJob.job_type === 'PARAMETER_SEARCH' && selectedJob.selected_experiment && (
                  <div>
                    <span>{tx('Kandidat Rekomendasi', 'Recommended Candidate')}</span>
                    <strong>
                      {tx('Eksperimen', 'Experiment')} #{selectedJob.selected_experiment.id} (ε {formatNumber(selectedJob.selected_experiment.eps_km, 2)} km, MinPts {selectedJob.selected_experiment.min_samples})
                    </strong>
                  </div>
                )}
                {selectedJob.parent_job_id && <div><span>{tx('Proses sebelumnya', 'Parent Job')}</span><strong>#{selectedJob.parent_job_id}</strong></div>}
                {selectedJob.pause_requested_at && <div><span>{tx('Permintaan jeda', 'Pause Requested')}</span><strong>{formatDate(selectedJob.pause_requested_at)}</strong></div>}
                {selectedJob.paused_at && <div><span>{tx('Terakhir dijeda', 'Last Paused')}</span><strong>{formatDate(selectedJob.paused_at)}</strong></div>}
                {selectedJob.stop_requested_at && <div><span>{tx('Permintaan penghentian', 'Stop Requested')}</span><strong>{formatDate(selectedJob.stop_requested_at)}</strong></div>}
              </div>
              <JobLifecycleControls
                job={selectedJob}
                onJobChanged={() => { selectedJobState.reload(); setRefreshKey((value) => value + 1); }}
                onRestarted={(newJobId) => {
                  setSelectedDatasetId(selectedJob.dataset_id);
                  if (selectedJob.job_type === 'PARAMETER_SEARCH') setParameterJobId(newJobId);
                  setSelectedJobId(newJobId);
                  setRefreshKey((value) => value + 1);
                }}
              />
              {selectedJob.status === 'SUCCESS' && selectedJob.job_type === 'FINAL_CLUSTERING' && selectedJob.run_id && <button className="button button-secondary" type="button" onClick={() => navigate('/admin/riwayat-run')}><Database size={14} /> {tx('Buka Riwayat Eksekusi', 'Open Execution History')}</button>}
            </div>
            {selectedJob.job_type === 'PARAMETER_SEARCH' && <div className="job-experiment-panel">
              {selectedJob.status === 'SUCCESS' && <button className="button button-secondary job-open-elbow" type="button" onClick={() => useJobForElbow(selectedJob)}><BarChart3 size={14} /> {tx('Buka Analisis K-Distance', 'Open k-Distance Analysis')} <ArrowRight size={13} /></button>}
              <div className="job-experiment-heading"><div><strong>{tx('Hasil eksperimen', 'Experiment Results')}</strong><small>{tx('Hasil pencarian parameter untuk proses ini', 'Parameter search evaluations for this job')}</small></div><span>{experiments.length} {tx('kandidat', 'candidates')}</span></div>
              {selectedJob.status !== 'SUCCESS' ? <StatePanel type="info" title={tx('Menunggu proses selesai', 'Waiting for completion')} message={tx('Hasil eksperimen tersedia setelah proses berhasil.', 'Experiment results become available after job completion.')} />
                : experimentsLoading ? <StatePanel type="loading" title={tx('Memuat eksperimen', 'Loading experiments')} message={tx('Mengambil seluruh kandidat dari proses ini.', 'Fetching candidate experiments for this job.')} />
                  : experimentsError ? <StatePanel type="error" title={tx('Hasil eksperimen gagal dimuat', 'Failed to load experiments')} message={experimentsError} />
                    : !experiments.length ? <StatePanel type="empty" title={tx('Belum ada hasil eksperimen', 'No experiments found')} message={tx('Belum ada kandidat yang dikembalikan untuk proses ini.', 'No candidate experiments were returned for this job.')} />
                      : <>
                        <div className="table-scroll">
                          <table className="data-table compact-job-experiments">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>ε km</th>
                                <th>MinPts</th>
                                <th>{tx('Klaster', 'Clusters')}</th>
                                <th>Noise (%)</th>
                                <th>{tx('Dominasi', 'Dominance')}</th>
                                <th>Silhouette</th>
                                <th>{tx('Stabilitas', 'Stability')}</th>
                                <th>{tx('Skor Rekom.', 'Rec. Score')}</th>
                                <th>{tx('Validitas', 'Validity')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {experiments.map((experiment) => (
                                <tr key={experiment.id} className={experiment.is_recommended ? 'job-row-recommended' : ''}>
                                  <td>
                                    <strong>#{experiment.id}</strong>
                                    {experiment.is_recommended && <span className="recommended-label" style={{ display: 'inline-block', marginLeft: '4px', fontSize: '0.7rem' }}>Top</span>}
                                  </td>
                                  <td>
                                    {formatNumber(experiment.eps_km, 2)}
                                    {experiment.eps_sources && experiment.eps_sources.length > 0 && (
                                      <small className="table-sub" style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        {experiment.eps_sources.join(', ')}
                                      </small>
                                    )}
                                  </td>
                                  <td>{experiment.min_samples}</td>
                                  <td>{formatNumber(experiment.cluster_count)}</td>
                                  <td>{formatPercent(experiment.noise_percentage)}</td>
                                  <td>
                                    <span>{formatRatioPercent(experiment.largest_cluster_ratio)}</span>
                                    {experiment.max_cluster_size != null && (
                                      <small className="table-sub" style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        {tx('maks', 'max')} {formatNumber(experiment.max_cluster_size)}
                                      </small>
                                    )}
                                  </td>
                                  <td>{experiment.silhouette_score != null ? formatNumber(experiment.silhouette_score, 4) : '—'}</td>
                                  <td>{experiment.stability_score != null ? formatNumber(experiment.stability_score, 4) : '—'}</td>
                                  <td>
                                    <strong>{experiment.recommendation_score != null ? formatNumber(experiment.recommendation_score, 4) : '—'}</strong>
                                  </td>
                                  <td className="invalid-cell">
                                    <StatusBadge status={experiment.invalid_reasons === null ? 'HISTORIS' : experiment.is_valid ? 'VALID' : 'INVALID'} />
                                    {experiment.invalid_reasons && experiment.invalid_reasons.length > 0 && (
                                      <small className="invalid-reasons-text" title={experiment.invalid_reasons.map((r) => formatInvalidReason(r, undefined, lang)).join('; ')}>
                                        {experiment.invalid_reasons.map((r) => formatInvalidReason(r, undefined, lang)).join(', ')}
                                      </small>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {experiments.some((experiment) => experiment.is_valid) && <button className="button button-primary job-use-experiments" type="button" onClick={() => useJobForFinal(selectedJob)}><Workflow size={15} /> {tx('Pilih eksperimen untuk DBSCAN Final', 'Select experiment for Final DBSCAN')} <ArrowRight size={14} /></button>}
                        <p className="job-experiment-note">{tx('Hasil eksperimen tetap tersimpan. Tombol ini meneruskan dataset dan proses terpilih ke halaman DBSCAN Final tanpa mengulang pencarian.', 'Experiment evaluations are saved. This button carries the dataset and selected job to Final DBSCAN without rerunning search.')}</p>
                      </>}
            </div>}
          </div>}
    </GlassCard>}
  </div>;
}
