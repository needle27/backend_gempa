import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BarChart3, CheckCircle2, Clock3, Database, Filter, ListTodo,
  RefreshCw, Search, Workflow, XCircle,
} from 'lucide-react';
import { getDatasets, getExperiments, getJobs, type JobListFilters } from '../../api/services';
import { usePipeline } from '../../context/PipelineContext';
import { JobLifecycleControls } from '../../components/JobLifecycleControls';
import { useJobPolling } from '../../hooks/useJobPolling';
import { useResource } from '../../hooks/useResource';
import {
  GlassCard, PageHeader, SimulationTag, StatePanel, StatusBadge, StatCard,
  formatDate, formatNumber,
} from '../../components/ui';
import { friendlyErrorMessage, jobTypeLabel, processStepLabel } from '../../utils/presentation';
import type { ParameterExperiment, ProcessingJob } from '../../types/domain';

const DEFAULT_LIMIT = 20;
const NON_TERMINAL_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'STOP_REQUESTED']);
const POLLING_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'STOP_REQUESTED']);

function isActive(job: ProcessingJob): boolean {
  return NON_TERMINAL_STATUSES.has(job.status);
}

export function JobManagementPage() {
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getJobs({ ...filters, page }).then((result) => {
      if (active) setJobs(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Daftar proses gagal dimuat.');
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
      if (active) setExperimentsError(reason instanceof Error ? reason.message : 'Hasil eksperimen gagal dimuat.');
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
      setFilterError('ID Dataset harus berupa integer positif.');
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
      eyebrow="ADMIN / PEMANTAUAN PROSES"
      title="Manajemen Proses"
      description="Pantau Pencarian Parameter dan Klasterisasi Final, buka kembali hasil eksperimen, lalu lanjutkan ke DBSCAN Final tanpa mengulang pencarian."
      action={<SimulationTag />}
    />

    <div className="stats-grid job-stats-grid">
      <StatCard label="Total proses sesuai filter" value={total === null || total === undefined ? '—' : formatNumber(total)} icon={<ListTodo size={17} />} tone="cyan" trend="Jumlah seluruh proses sesuai filter" />
      <StatCard label="Belum selesai" value={formatNumber(activeOnPage)} icon={<Activity size={17} />} tone="amber" trend="Termasuk proses yang dijeda" />
      <StatCard label="Berhasil" value={formatNumber(successOnPage)} icon={<CheckCircle2 size={17} />} tone="teal" trend="Pada halaman ini" />
      <StatCard label="Gagal" value={formatNumber(failedOnPage)} icon={<XCircle size={17} />} tone="violet" trend="Pada halaman ini" />
    </div>

    <section className="glass-card job-filter-card">
      <div className="card-heading">
        <div><h3><Filter size={16} /> Filter proses</h3><p>Saring proses berdasarkan status, jenis, atau dataset.</p></div>
        <button className="button button-secondary" type="button" onClick={resetFilters}>Reset filter</button>
      </div>
      <form className="job-filter-grid" onSubmit={applyFilters}>
        <label>Status
          <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="">Semua status</option>
            <option value="QUEUED">Dalam antrean</option><option value="RUNNING">Sedang berjalan</option>
            <option value="PAUSE_REQUESTED">Sedang menjeda</option><option value="PAUSED">Dijeda</option><option value="STOP_REQUESTED">Sedang menghentikan</option><option value="SUCCESS">Berhasil</option><option value="FAILED">Gagal</option><option value="CANCELLED">Dibatalkan</option>
          </select>
        </label>
        <label>Jenis proses
          <select value={draft.job_type} onChange={(event) => setDraft({ ...draft, job_type: event.target.value })}>
            <option value="">Semua jenis</option><option value="PARAMETER_SEARCH">Pencarian Parameter</option><option value="FINAL_CLUSTERING">Klasterisasi Final</option>
          </select>
        </label>
        <label>ID Dataset
          <input inputMode="numeric" value={draft.dataset_id} onChange={(event) => setDraft({ ...draft, dataset_id: event.target.value })} placeholder="Contoh: 1" />
        </label>
        <label>Jumlah per halaman
          <select value={filters.limit || DEFAULT_LIMIT} onChange={(event) => { const limit = Number(event.target.value); setPage(1); setFilters((current) => ({ ...current, page: 1, limit })); }}>
            <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
          </select>
        </label>
        {filterError && <div className="form-error job-filter-wide">{filterError}</div>}
        <div className="job-filter-actions job-filter-wide">
          <button className="button button-primary" type="submit"><Search size={15} /> Terapkan filter</button>
          <button className="button button-secondary" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}><RefreshCw size={14} /> Muat ulang</button>
        </div>
      </form>
    </section>

    <GlassCard title="Daftar proses" subtitle="Proses sebelumnya tetap dapat dibuka selama datanya tersedia.">
      {!jobs && loading ? <StatePanel type="loading" title="Memuat daftar proses" message="Mengambil proses dan status terbaru." />
        : !jobs && error ? <StatePanel type="error" title="Daftar proses belum tersedia" message={error} action={<button className="button button-secondary" onClick={() => setRefreshKey((value) => value + 1)}>Coba lagi</button>} />
          : !jobs?.items.length ? <StatePanel type="empty" title="Proses tidak ditemukan" message="Tidak ada proses yang sesuai dengan filter. Hapus filter atau jalankan proses melalui halaman Pencarian Parameter atau DBSCAN Final." />
            : <>
              {error && <div className="job-refresh-warning" role="status">Pembaruan status gagal. Data terakhir tetap ditampilkan. {error}</div>}
              <div className="job-list-meta"><span><strong>{total === null ? formatNumber(jobs.items.length) : formatNumber(total)}</strong> proses sesuai</span><span>{loading && <span className="job-refresh-indicator"><i /> Memperbarui status</span>} Halaman {page}{totalPages ? ` dari ${totalPages}` : ''} · {formatNumber(jobs.items.length)} ditampilkan</span></div>
              <div className="table-scroll"><table className="data-table job-table"><thead><tr><th>Proses</th><th>Jenis proses</th><th>Dataset</th><th>Kemajuan</th><th>Status</th><th>Dibuat</th><th /></tr></thead><tbody>
                {jobs.items.map((job) => <tr key={job.id} className={selectedJobId === job.id ? 'job-row-selected' : ''}>
                  <td><strong>#{job.id}</strong><small className="table-sub">{job.parent_job_id ? `Lanjutan dari proses #${job.parent_job_id}` : job.run_id ? `Eksekusi #${job.run_id}` : `Proses #${job.id}`}</small></td>
                  <td>{jobTypeLabel(job.job_type)}</td>
                  <td><strong>{datasetNames.get(job.dataset_id) || `Dataset #${job.dataset_id}`}</strong><small className="table-sub">ID {job.dataset_id}</small></td>
                  <td><div className="job-table-progress"><span><i style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }} /></span><small>{formatNumber(job.progress || 0)}%</small></div></td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>{formatDate(job.created_at)}</td>
                  <td><button className="text-button" type="button" onClick={() => selectJob(job.id)}>Rincian <ArrowRight size={13} /></button></td>
                </tr>)}
              </tbody></table></div>
              <div className="audit-pagination job-pagination">
                <span>Menampilkan {formatNumber((jobs.offset || 0) + 1)}–{formatNumber((jobs.offset || 0) + jobs.items.length)}{total !== null ? ` dari ${formatNumber(total)}` : ''}</span>
                <div>
                  <button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
                  <button className="button button-secondary" disabled={!jobs.hasMore || loading} onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
                </div>
              </div>
            </>}
    </GlassCard>

    {selectedJobId !== null && <GlassCard title={`Rincian Proses #${selectedJobId}`} subtitle="Informasi status proses yang dipilih." action={<button className="button button-ghost" type="button" onClick={() => setSelectedJobId(null)}>Tutup</button>}>
      {selectedJobState.error ? <StatePanel type="error" title="Rincian proses gagal dimuat" message={selectedJobState.error} />
        : !selectedJob ? <StatePanel type="loading" title="Memuat rincian proses" message="Mengambil status, kemajuan, dan informasi proses." />
          : <div className="job-detail-layout">
            <div className="job-detail-main">
              <div className="job-detail-heading"><div><span className="eyebrow">{jobTypeLabel(selectedJob.job_type)}</span><h3>Proses #{selectedJob.id}</h3></div><StatusBadge status={selectedJob.status} /></div>
              <div className="job-detail-progress"><div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, selectedJob.progress || 0))}%` }} /></div><div className="progress-label"><strong>{formatNumber(selectedJob.progress || 0)}%</strong><span>{selectedJob.current_step ? processStepLabel(selectedJob.current_step) : selectedJob.message || 'Menunggu pembaruan status'}</span></div></div>
              {selectedJob.message && <p className="job-detail-message">{friendlyErrorMessage(selectedJob.message)}</p>}
              {selectedJob.error_code && <div className="form-error">{friendlyErrorMessage(selectedJob.error_code)}</div>}
              <div className="job-detail-fields">
                <div><span>Dataset</span><strong>{datasetNames.get(selectedJob.dataset_id) || `#${selectedJob.dataset_id}`}</strong></div>
                <div><span>ID Eksekusi</span><strong>{selectedJob.run_id ? `#${selectedJob.run_id}` : '—'}</strong></div>
                <div><span>Dibuat</span><strong>{formatDate(selectedJob.created_at)}</strong></div>
                <div><span>Dimulai</span><strong>{formatDate(selectedJob.started_at)}</strong></div>
                <div><span>Selesai</span><strong>{formatDate(selectedJob.finished_at)}</strong></div>
                {selectedJob.parent_job_id && <div><span>Proses sebelumnya</span><strong>#{selectedJob.parent_job_id}</strong></div>}
                {selectedJob.pause_requested_at && <div><span>Permintaan jeda</span><strong>{formatDate(selectedJob.pause_requested_at)}</strong></div>}
                {selectedJob.paused_at && <div><span>Terakhir dijeda</span><strong>{formatDate(selectedJob.paused_at)}</strong></div>}
                {selectedJob.stop_requested_at && <div><span>Permintaan penghentian</span><strong>{formatDate(selectedJob.stop_requested_at)}</strong></div>}
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
              {selectedJob.status === 'SUCCESS' && selectedJob.job_type === 'FINAL_CLUSTERING' && selectedJob.run_id && <button className="button button-secondary" type="button" onClick={() => navigate('/admin/riwayat-run')}><Database size={14} /> Buka Riwayat Eksekusi</button>}
            </div>
            {selectedJob.job_type === 'PARAMETER_SEARCH' && <div className="job-experiment-panel">
              {selectedJob.status === 'SUCCESS' && <button className="button button-secondary job-open-elbow" type="button" onClick={() => useJobForElbow(selectedJob)}><BarChart3 size={14} /> Buka Analisis K-Distance <ArrowRight size={13} /></button>}
              <div className="job-experiment-heading"><div><strong>Hasil eksperimen</strong><small>Hasil pencarian parameter untuk proses ini</small></div><span>{experiments.length} kandidat</span></div>
              {selectedJob.status !== 'SUCCESS' ? <StatePanel type="info" title="Menunggu proses selesai" message="Hasil eksperimen tersedia setelah proses berhasil." />
                : experimentsLoading ? <StatePanel type="loading" title="Memuat eksperimen" message="Mengambil seluruh kandidat dari proses ini." />
                  : experimentsError ? <StatePanel type="error" title="Hasil eksperimen gagal dimuat" message={experimentsError} />
                    : !experiments.length ? <StatePanel type="empty" title="Belum ada hasil eksperimen" message="Belum ada kandidat yang dikembalikan untuk proses ini." />
                      : <>
                        <div className="table-scroll"><table className="data-table compact-job-experiments"><thead><tr><th>ID</th><th>ε km</th><th>MinPts</th><th>Klaster</th><th>Noise (%)</th><th>Validitas</th></tr></thead><tbody>{experiments.map((experiment) => <tr key={experiment.id}><td>#{experiment.id}</td><td>{formatNumber(experiment.eps_km, 2)}</td><td>{experiment.min_samples}</td><td>{formatNumber(experiment.cluster_count)}</td><td>{formatNumber(experiment.noise_percentage, 2)}%</td><td><StatusBadge status={experiment.is_valid ? 'VALID' : 'INVALID'} /></td></tr>)}</tbody></table></div>
                        {experiments.some((experiment) => experiment.is_valid) && <button className="button button-primary job-use-experiments" type="button" onClick={() => useJobForFinal(selectedJob)}><Workflow size={15} /> Pilih eksperimen untuk DBSCAN Final <ArrowRight size={14} /></button>}
                        <p className="job-experiment-note">Hasil eksperimen tetap tersimpan. Tombol ini meneruskan dataset dan proses terpilih ke halaman DBSCAN Final tanpa mengulang pencarian.</p>
                      </>}
            </div>}
          </div>}
    </GlassCard>}

    <div className="admin-note"><Clock3 size={16} /><span>Status proses yang masih berjalan atau menunggu checkpoint diperbarui otomatis. Proses yang dijeda tetap tersimpan dan dapat dilanjutkan dari checkpoint terakhir.</span></div>
  </div>;
}
