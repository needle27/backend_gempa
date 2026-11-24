import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock3, Database, ExternalLink,
  ListTodo, MapPinned, Play, RefreshCw, Workflow,
} from 'lucide-react';
import { getDatasets, getExperiments, getJob, getJobs, startFinalDbscan } from '../../api/services';
import { JobLifecycleControls } from '../../components/JobLifecycleControls';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { IS_PREVIEW_MODE } from '../../config/env';
import { usePipeline } from '../../context/PipelineContext';
import { useJobPolling } from '../../hooks/useJobPolling';
import { useResource } from '../../hooks/useResource';
import {
  GlassCard, PageHeader, PrimaryButton, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber,
} from '../../components/ui';
import { ApiError } from '../../types/api';
import type { ParameterExperiment, ProcessingJob } from '../../types/domain';
import {
  friendlyErrorMessage, processStepLabel, statusLabel,
  formatPercent, formatRatioPercent, formatInvalidReason,
} from '../../utils/presentation';

const FINAL_JOB_STORAGE_KEY = 'seismap:finalDbscanJobId';
const FINAL_RUN_STORAGE_KEY = 'seismap:finalDbscanRunId';
const ACTIVE_JOB_STATUSES = new Set(['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'STOP_REQUESTED']);

function readStoredId(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch { return null; }
}

function persistStoredId(key: string, value: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, String(value));
  } catch { /* Session storage may be disabled by the browser. */ }
}

export function FinalDbscanPage() {
  const [searchParams] = useSearchParams();
  const urlDatasetId = Number(searchParams.get('datasetId')) || null;
  const urlJobId = Number(searchParams.get('jobId')) || null;
  const urlExperimentId = Number(searchParams.get('experimentId')) || null;

  const datasets = useResource(getDatasets, []);
  const {
    selectedDatasetId, setSelectedDatasetId, parameterJobId, setParameterJobId,
  } = usePipeline();

  // Initialize pipeline context from URL parameters if provided
  useEffect(() => {
    if (urlDatasetId && urlDatasetId !== selectedDatasetId) {
      setSelectedDatasetId(urlDatasetId);
    }
    if (urlJobId && urlJobId !== parameterJobId) {
      setParameterJobId(urlJobId);
    }
    if (urlExperimentId) {
      setExperimentId(urlExperimentId);
    }
  }, [urlDatasetId, urlJobId, urlExperimentId]);

  const effectiveDatasetId = selectedDatasetId ?? urlDatasetId ?? datasets.data?.[0]?.id ?? null;
  const effectiveParameterJobId = IS_PREVIEW_MODE ? (parameterJobId ?? urlJobId ?? 51) : (parameterJobId ?? urlJobId);

  const [availableJobs, setAvailableJobs] = useState<ProcessingJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsHasMore, setJobsHasMore] = useState(false);
  const [jobsTotal, setJobsTotal] = useState<number | null>(null);
  const [jobsReloadKey, setJobsReloadKey] = useState(0);
  const [sourceJob, setSourceJob] = useState<ProcessingJob | null>(null);
  const [experiments, setExperiments] = useState<ParameterExperiment[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [experimentId, setExperimentId] = useState<number | null>(() => urlExperimentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [jobId, setJobId] = useState<number | null>(() => readStoredId(FINAL_JOB_STORAGE_KEY));
  const [runId, setRunId] = useState<number | null>(() => readStoredId(FINAL_RUN_STORAGE_KEY));
  const jobState = useJobPolling(jobId);

  useEffect(() => {
    persistStoredId(FINAL_JOB_STORAGE_KEY, jobId);
  }, [jobId]);

  useEffect(() => {
    persistStoredId(FINAL_RUN_STORAGE_KEY, runId);
  }, [runId]);

  // Load completed Pencarian Parameter jobs for the selected dataset.
  // The user can choose a source job directly on this page; Manajemen Proses remains optional.
  useEffect(() => {
    let active = true;

    if (datasets.loading) {
      setJobsLoading(true);
      return () => { active = false; };
    }

    if (!effectiveDatasetId) {
      setAvailableJobs([]);
      setJobsHasMore(false);
      setJobsTotal(0);
      setJobsLoading(false);
      setJobsError(null);
      return () => { active = false; };
    }

    setJobsLoading(true);
    setJobsError(null);

    void getJobs({
      page: jobsPage,
      limit: 20,
      status: 'SUCCESS',
      job_type: 'PARAMETER_SEARCH',
      dataset_id: effectiveDatasetId,
    }).then((result) => {
      if (!active) return;
      const matchingJobs = result.items.filter((job) =>
        job.status === 'SUCCESS' &&
        job.job_type === 'PARAMETER_SEARCH' &&
        job.dataset_id === effectiveDatasetId,
      );
      setAvailableJobs(matchingJobs);
      setJobsHasMore(result.hasMore);
      setJobsTotal(result.total);
    }).catch((reason) => {
      if (!active) return;
      setAvailableJobs([]);
      setJobsHasMore(false);
      setJobsTotal(null);
      setJobsError(reason instanceof Error ? reason.message : 'Daftar proses Pencarian Parameter gagal dimuat.');
    }).finally(() => {
      if (active) setJobsLoading(false);
    });

    return () => { active = false; };
  }, [effectiveDatasetId, datasets.loading, jobsPage, jobsReloadKey]);

  useEffect(() => {
    let active = true;
    setSourceJob(null);
    setExperiments([]);
    setExperimentId(null);
    setSourceError(null);

    if (!effectiveParameterJobId) {
      setSourceLoading(false);
      return () => { active = false; };
    }
    if (datasets.loading) {
      setSourceLoading(true);
      return () => { active = false; };
    }
    if (!effectiveDatasetId) {
      setSourceLoading(false);
      setSourceError('Pilih dataset terlebih dahulu sebelum membuka eksperimen.');
      return () => { active = false; };
    }

    setSourceLoading(true);
    const loadSource = async () => {
      try {
        const job = await getJob(effectiveParameterJobId);
        if (!active) return;
        setSourceJob(job);

        if (job.job_type !== 'PARAMETER_SEARCH') {
          setSourceError(`Proses #${job.id} bukan Pencarian Parameter. Pilih proses Pencarian Parameter dari daftar pada halaman ini.`);
          return;
        }
        if (job.dataset_id !== effectiveDatasetId) {
          setSourceError(`Proses #${job.id} berasal dari Dataset #${job.dataset_id}, sedangkan dataset yang dipilih adalah #${effectiveDatasetId}. Pilih proses dari dataset yang sesuai.`);
          return;
        }
        if (job.status !== 'SUCCESS') {
          setSourceError(job.status === 'FAILED'
            ? `Pencarian Parameter pada proses #${job.id} gagal. Periksa rinciannya di Manajemen Proses bila diperlukan.`
            : `Hasil eksperimen baru dapat digunakan setelah proses #${job.id} berhasil. Status saat ini: ${statusLabel(job.status)}.`);
          return;
        }

        const rows = await getExperiments(job.id);
        if (!active) return;
        const matchingRows = rows.filter((item) => item.dataset_id === job.dataset_id && item.job_id === job.id);
        setExperiments(matchingRows);
        if (matchingRows.length !== rows.length) {
          setSourceError('Sebagian hasil eksperimen tidak sesuai dengan dataset atau proses sumber sehingga tidak ditampilkan. Periksa konsistensi data pada sistem.');
        }
        if (!matchingRows.some((item) => item.is_valid)) {
          setSourceError('Proses selesai, tetapi tidak memiliki eksperimen valid yang sesuai dengan dataset ini. Periksa hasil evaluasinya bila diperlukan.');
        }
      } catch (reason) {
        if (!active) return;
        setSourceError(reason instanceof Error ? reason.message : 'Proses sumber atau hasil eksperimen gagal dimuat.');
      } finally {
        if (active) setSourceLoading(false);
      }
    };
    void loadSource();
    return () => { active = false; };
  }, [effectiveParameterJobId, effectiveDatasetId, datasets.loading]);

  const [filterMode, setFilterMode] = useState<'VALID_ONLY' | 'ALL'>('VALID_ONLY');

  const matchingExperiments = useMemo(
    () => experiments.filter((item) => item.dataset_id === effectiveDatasetId && item.job_id === effectiveParameterJobId),
    [experiments, effectiveDatasetId, effectiveParameterJobId],
  );

  const hasAnyValid = useMemo(
    () => matchingExperiments.some((item) => item.is_valid === true),
    [matchingExperiments],
  );

  const validExperiments = useMemo(
    () => matchingExperiments.filter((item) => item.is_valid === true),
    [matchingExperiments],
  );

  // Default sorting:
  // 1. Recommended top
  // 2. Valid top
  // 3. Recommendation score desc (if finite)
  // 4. Silhouette score desc (if finite)
  const sortedExperiments = useMemo(() => {
    return [...matchingExperiments].sort((a, b) => {
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;

      const aValid = a.is_valid === true ? 1 : 0;
      const bValid = b.is_valid === true ? 1 : 0;
      if (aValid !== bValid) return bValid - aValid;

      const aRec = a.recommendation_score != null && Number.isFinite(a.recommendation_score) ? a.recommendation_score : -999;
      const bRec = b.recommendation_score != null && Number.isFinite(b.recommendation_score) ? b.recommendation_score : -999;
      if (aRec !== bRec) return bRec - aRec;

      const aSil = a.silhouette_score != null && Number.isFinite(a.silhouette_score) ? a.silhouette_score : -999;
      const bSil = b.silhouette_score != null && Number.isFinite(b.silhouette_score) ? b.silhouette_score : -999;
      return bSil - aSil;
    });
  }, [matchingExperiments]);

  // If no valid experiment in the list (e.g. historical data or all invalid), show all items
  const effectiveFilterMode = hasAnyValid ? filterMode : 'ALL';

  const displayedExperiments = useMemo(() => {
    if (effectiveFilterMode === 'VALID_ONLY') {
      return sortedExperiments.filter((item) => item.is_valid === true);
    }
    return sortedExperiments;
  }, [sortedExperiments, effectiveFilterMode]);

  const selectedExperiment = useMemo(
    () => matchingExperiments.find((item) => item.id === experimentId) ?? null,
    [matchingExperiments, experimentId],
  );

  // Auto-select top recommended/valid experiment on initial load if none selected, or URL experiment
  useEffect(() => {
    if (urlExperimentId && sortedExperiments.some((item) => item.id === urlExperimentId)) {
      setExperimentId(urlExperimentId);
      return;
    }
    if (!experimentId && sortedExperiments.length > 0) {
      const topChoice = sortedExperiments.find((item) => item.is_valid === true) ?? sortedExperiments[0];
      if (topChoice) {
        setExperimentId(topChoice.id);
      }
    }
  }, [experimentId, sortedExperiments, urlExperimentId]);

  const currentFinalJob = jobState.job?.id === jobId ? jobState.job : null;
  const activeFinalJob = Boolean(currentFinalJob && ACTIVE_JOB_STATUSES.has(currentFinalJob.status));
  const restoringFinalJob = Boolean(jobId && !currentFinalJob && !jobState.error);
  const finalJobStatusUnknown = Boolean(jobId && jobState.error && !currentFinalJob);
  const resolvedRunId = currentFinalJob?.run_id ?? runId;
  const canSubmit = Boolean(
    !IS_PREVIEW_MODE && !busy && !activeFinalJob && !restoringFinalJob && !finalJobStatusUnknown &&
    effectiveDatasetId && selectedExperiment && selectedExperiment.is_valid === true &&
    sourceJob?.status === 'SUCCESS' && !sourceError,
  );

  const handleDatasetChange = (nextDatasetId: number | null) => {
    if (nextDatasetId !== effectiveDatasetId) {
      setParameterJobId(null);
      setExperimentId(null);
      setExperiments([]);
      setSourceJob(null);
      setSourceError(null);
      setJobsPage(1);
      setJobsError(null);
    }
    setSelectedDatasetId(nextDatasetId);
  };

  const handleParameterJobChange = (nextJobId: number | null) => {
    setParameterJobId(nextJobId);
    setExperimentId(null);
    setExperiments([]);
    setSourceJob(null);
    setSourceError(null);
    setError(null);
  };

  const handleConfirmClearTracking = () => {
    setJobId(null);
    setRunId(null);
    persistStoredId(FINAL_JOB_STORAGE_KEY, null);
    persistStoredId(FINAL_RUN_STORAGE_KEY, null);
    setShowClearModal(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!effectiveDatasetId || !selectedExperiment || !sourceJob || sourceJob.status !== 'SUCCESS') {
      setError('Pilih dataset dan eksperimen valid dari proses Pencarian Parameter yang berhasil dan berasal dari dataset yang sama.');
      return;
    }
    if (activeFinalJob || restoringFinalJob || finalJobStatusUnknown) {
      setError('Status proses DBSCAN Final sebelumnya belum dapat dipastikan aman untuk membuat eksekusi baru. Periksa Manajemen Proses terlebih dahulu.');
      return;
    }

    setBusy(true);
    try {
      // Check every non-terminal lifecycle state so a paused or transitioning Job also blocks duplicates.
      const filters = { page: 1, limit: 50, job_type: 'FINAL_CLUSTERING', dataset_id: effectiveDatasetId };
      const nonTerminalStatuses = ['QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'STOP_REQUESTED'] as const;
      const nonTerminalResults = await Promise.all(nonTerminalStatuses.map((status) => getJobs({ ...filters, status })));
      const existingActiveJob = nonTerminalResults.flatMap((result) => result.items).find(
        (job) => job.dataset_id === effectiveDatasetId && job.job_type === 'FINAL_CLUSTERING' && ACTIVE_JOB_STATUSES.has(job.status),
      );
      if (existingActiveJob) {
        setJobId(existingActiveJob.id);
        setRunId(existingActiveJob.run_id);
        if (jobId === existingActiveJob.id) jobState.reload();
        setError(`Ditemukan Klasterisasi Final yang belum selesai untuk Dataset #${effectiveDatasetId}. Proses #${existingActiveJob.id} dipulihkan; tidak membuat proses baru.`);
        return;
      }

      const result = await startFinalDbscan(effectiveDatasetId, selectedExperiment.id);
      setJobId(result.job_id);
      setRunId(result.run_id);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        const existingJobId = Number(reason.details?.job_id);
        if (Number.isInteger(existingJobId) && existingJobId > 0) {
          setJobId(existingJobId);
          setRunId(null);
          if (jobId === existingJobId) jobState.reload();
          setError(`Sistem mencegah eksekusi ganda dan menemukan proses yang belum selesai (#${existingJobId}). Statusnya sedang dipulihkan.`);
        } else {
          setError(reason.message);
        }
      } else {
        setError(reason instanceof Error
          ? `DBSCAN Final tidak dikirim karena pemeriksaan proses aktif gagal: ${reason.message}`
          : 'DBSCAN Final tidak dikirim karena status proses aktif tidak dapat dipastikan.');
      }
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-stack">
    <PageHeader
      eyebrow="ADMIN / KLASTERISASI FINAL"
      title="DBSCAN Final"
      description="Pilih dataset, proses Pencarian Parameter yang berhasil, lalu eksperimen yang valid langsung di halaman ini. Klasterisasi final dijalankan oleh sistem."
      action={<SimulationTag />}
    />

    <div className="final-workflow-banner">
      <div className="final-workflow-icon"><Workflow size={19} /></div>
      <div>
        <strong>Alur DBSCAN Final</strong>
        <p>Pilih dataset → pilih proses yang berhasil → pilih eksperimen valid → jalankan DBSCAN Final.</p>
      </div>
      <Link className="button button-secondary final-workflow-link" to="/admin/jobs"><ListTodo size={14} /> Lihat Semua Proses <ArrowRight size={13} /></Link>
    </div>

    <div className="final-layout">
      <GlassCard title="Konfigurasi DBSCAN Final" subtitle="Parameter klasterisasi diambil dari eksperimen terpilih. Epsilon, MinPts, dan batas kedalaman tidak perlu diisi secara manual.">
        <form className="stack-form" onSubmit={submit}>
          <label>Dataset
            <select
              value={effectiveDatasetId ?? ''}
              onChange={(event) => handleDatasetChange(Number(event.target.value) || null)}
              disabled={datasets.loading || !datasets.data?.length}
            >
              <option value="">Pilih dataset</option>
              {datasets.data?.map((item) => <option key={item.id} value={item.id}>{item.dataset_name} · {statusLabel(item.status)}</option>)}
            </select>
          </label>

          <label>Proses Pencarian Parameter
            <select
              value={effectiveParameterJobId ?? ''}
              onChange={(event) => handleParameterJobChange(Number(event.target.value) || null)}
              disabled={jobsLoading || !effectiveDatasetId || (!availableJobs.length && !sourceJob)}
            >
              <option value="">Pilih Proses Pencarian Parameter</option>
              {sourceJob &&
                sourceJob.job_type === 'PARAMETER_SEARCH' &&
                sourceJob.status === 'SUCCESS' &&
                sourceJob.dataset_id === effectiveDatasetId &&
                !availableJobs.some((item) => item.id === sourceJob.id) && (
                  <option value={sourceJob.id}>Proses #{sourceJob.id} · Berhasil · dipilih sebelumnya</option>
                )}
              {availableJobs.map((item) => (
                <option key={item.id} value={item.id}>
                  Proses #{item.id} · {friendlyErrorMessage(item.message || 'Pencarian Parameter selesai')}
                </option>
              ))}
            </select>
            <small>Daftar otomatis disaring berdasarkan dataset terpilih dan hanya menampilkan proses Pencarian Parameter yang berhasil.</small>
          </label>

          <div className="final-source-row">
            <div>
              <span className="eyebrow">PROSES PENCARIAN PARAMETER YANG BERHASIL</span>
              <strong>{jobsLoading ? 'Memuat daftar proses…' : `${jobsTotal ?? availableJobs.length} proses ditemukan`}</strong>
              <small>{sourceJob ? `Sumber aktif: Proses #${sourceJob.id} · Dataset #${sourceJob.dataset_id}` : 'Pilih proses untuk memuat eksperimen yang valid.'}</small>
            </div>
            <div className="final-job-error-actions">
              <button className="button button-ghost" type="button" disabled={jobsLoading || !effectiveDatasetId} onClick={() => setJobsReloadKey((value) => value + 1)}>
                <RefreshCw size={13} /> Muat ulang
              </button>
              <Link className="button button-ghost" to="/admin/jobs">Semua proses <ArrowRight size={13} /></Link>
            </div>
          </div>

          {jobsError && <StatePanel type="error" title="Daftar proses gagal dimuat" message={jobsError} action={<button className="button button-secondary" type="button" onClick={() => setJobsReloadKey((value) => value + 1)}><RefreshCw size={13} /> Coba lagi</button>} />}
          {!jobsLoading && !jobsError && effectiveDatasetId && availableJobs.length === 0 && (
            <StatePanel type="info" title="Belum ada proses Pencarian Parameter yang berhasil" message={`Belum ditemukan proses Pencarian Parameter yang berhasil untuk Dataset #${effectiveDatasetId}. Jalankan pencarian parameter terlebih dahulu atau periksa Manajemen Proses.`} action={<Link className="button button-secondary" to="/admin/jobs"><ListTodo size={14} /> Lihat semua proses</Link>} />
          )}
          {availableJobs.length > 0 && (
            <div className="final-source-verified">
              <CheckCircle2 size={15} />
              <span>{availableJobs.length} proses berhasil tersedia untuk dataset ini.</span>
              <span className="subtle-copy">Halaman {jobsPage}</span>
              <div className="final-job-error-actions">
                <button className="button button-ghost" type="button" disabled={jobsLoading || jobsPage <= 1} onClick={() => setJobsPage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
                <button className="button button-ghost" type="button" disabled={jobsLoading || !jobsHasMore} onClick={() => setJobsPage((page) => page + 1)}>Berikutnya</button>
              </div>
            </div>
          )}

          {sourceLoading ? <StatePanel type="loading" title="Memeriksa proses sumber" message="Memastikan proses merupakan Pencarian Parameter yang berhasil dan berasal dari dataset yang dipilih." />
            : sourceError ? <StatePanel type="error" title="Proses sumber belum dapat digunakan" message={sourceError} action={<Link className="button button-secondary" to="/admin/jobs"><ListTodo size={14} /> Buka Manajemen Proses</Link>} />
              : !effectiveParameterJobId ? <StatePanel type="info" title="Pilih Proses Pencarian Parameter" message="Pilih salah satu proses yang berhasil pada daftar di atas. Hasil eksperimennya akan dimuat langsung di halaman ini." />
                : sourceJob && <div className="final-source-verified"><CheckCircle2 size={15} /><span>Proses sumber terverifikasi: Pencarian Parameter berhasil dan dataset sesuai.</span><StatusBadge status={sourceJob.status} /></div>}

          <label>Eksperimen yang akan dijalankan
            <select
              value={experimentId ?? ''}
              onChange={(event) => setExperimentId(Number(event.target.value) || null)}
              disabled={sourceLoading || !displayedExperiments.length || Boolean(sourceError)}
            >
              <option value="">Pilih eksperimen</option>
              {displayedExperiments.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.id} · ε {formatNumber(item.eps_km, 2)} km · MinPts {item.min_samples}
                  {item.is_recommended ? ' · Direkomendasikan' : ''}
                  {item.is_valid === false ? ' · (Tidak Valid)' : ''}
                </option>
              ))}
            </select>
            <small>
              {hasAnyValid
                ? 'Eksperimen valid dari proses dan dataset terpilih siap dijalankan untuk klasterisasi akhir.'
                : 'Menampilkan eksperimen yang tersedia. Eksperimen harus berstatus Valid untuk dapat dieksekusi.'}
            </small>
          </label>

          {selectedExperiment && selectedExperiment.is_valid === false && (
            <div className="final-invalid-warning">
              <div className="final-invalid-warning-head">
                <AlertTriangle size={16} />
                <strong>Eksperimen #{selectedExperiment.id} Berstatus Tidak Valid</strong>
              </div>
              <p>
                Eksperimen ini tidak memenuhi kriteria validasi metodologi skripsi sehingga tombol eksekusi dinonaktifkan:
              </p>
              <ul>
                {selectedExperiment.invalid_reasons && selectedExperiment.invalid_reasons.length > 0 ? (
                  selectedExperiment.invalid_reasons.map((reason, idx) => (
                    <li key={idx}>{formatInvalidReason(reason, sourceJob?.parameter_search_metadata?.validity_thresholds)}</li>
                  ))
                ) : (
                  <li>Parameter eksperimen berada di luar ambang batas klaster atau noise yang diperbolehkan.</li>
                )}
              </ul>
            </div>
          )}

          <div className="inline-notice"><MapPinned size={15} /> DBSCAN Final hanya menggunakan Latitude dan Longitude dengan metrik Haversine. Epsilon dan MinPts diambil dari eksperimen; kedalaman tetap digunakan untuk menyusun profil setelah klasterisasi.</div>
          {IS_PREVIEW_MODE && <div className="inline-notice"><span className="notice-dot" />Mode Pratinjau: eksekusi Final DBSCAN dinonaktifkan.</div>}
          {activeFinalJob && <div className="final-block-notice"><Clock3 size={15} /><span>Proses DBSCAN Final #{jobId} berstatus {currentFinalJob ? statusLabel(currentFinalJob.status) : 'belum diketahui'}. Proses belum terminal; lanjutkan atau hentikan melalui panel kemajuan sebelum membuat eksekusi baru.</span></div>}
          {restoringFinalJob && <div className="inline-notice"><RefreshCw size={14} className="spin" /> Memulihkan status proses Final DBSCAN terakhir dari sesi browser.</div>}
          {finalJobStatusUnknown && <div className="final-block-notice"><AlertTriangle size={15} /><span>Status proses #{jobId} belum dapat dipastikan: {friendlyErrorMessage(jobState.error ?? 'Tidak dapat memeriksa status proses saat ini.')} Periksa Manajemen Proses. Menghentikan pemantauan tidak membatalkan proses di server.</span></div>}
          {error && <div className="form-error">{error}</div>}
          <PrimaryButton type="submit" disabled={!canSubmit}>
            {busy ? 'Mengirim permintaan…' : activeFinalJob ? 'Final DBSCAN sedang berjalan' : restoringFinalJob ? 'Memulihkan status proses…' : <><Play size={15} /> Jalankan DBSCAN Final</>}
          </PrimaryButton>
        </form>
      </GlassCard>

      <GlassCard title="Ringkasan Eksperimen" subtitle="Periksa parameter dan metrik kandidat sebelum menjalankan klasterisasi final.">
        {selectedExperiment ? <div className="final-experiment-summary">
          <div className="final-experiment-heading">
            <div>
              <span className="eyebrow">EKSPERIMEN TERPILIH</span>
              <h3>Eksperimen #{selectedExperiment.id}</h3>
            </div>
            <div className="final-experiment-badges">
              <StatusBadge status={selectedExperiment.is_valid === true ? 'VALID' : selectedExperiment.is_valid === false ? 'INVALID' : 'HISTORIS'} />
              {selectedExperiment.is_recommended && <span className="recommended-label">Direkomendasikan</span>}
            </div>
          </div>
          <div className="final-parameter-grid">
            <div title="Jarak jangkauan ketetanggaan maksimum pada permukaan bumi (metrik Haversine).">
              <span>Epsilon</span>
              <strong className="tabular-nums">{formatNumber(selectedExperiment.eps_km, 2)} <small>km</small></strong>
            </div>
            <div title="Jumlah minimum titik tetangga agar sebuah titik diakui sebagai core point klaster.">
              <span>MinPts</span>
              <strong className="tabular-nums">{formatNumber(selectedExperiment.min_samples)}</strong>
            </div>
            <div title="Total klaster spasial gempa bumi yang berhasil dibentuk oleh DBSCAN.">
              <span>Jumlah Klaster</span>
              <strong className="tabular-nums">{formatNumber(selectedExperiment.cluster_count)}</strong>
            </div>
            <div title="Persentase gempa yang diklasifikasikan sebagai noise (tidak tergabung ke dalam klaster manapun).">
              <span>Persentase Noise</span>
              <strong className="tabular-nums">{formatPercent(selectedExperiment.noise_percentage)}</strong>
            </div>
            <div title="Proporsi titik pada klaster terbesar dibanding seluruh titik terklaster (mendeteksi efek chaining).">
              <span>Dominasi Klaster</span>
              <strong className="tabular-nums">{formatRatioPercent(selectedExperiment.largest_cluster_ratio)}</strong>
              {selectedExperiment.max_cluster_size != null && (
                <small className="table-sub tabular-nums" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Maks {formatNumber(selectedExperiment.max_cluster_size)} titik
                </small>
              )}
            </div>
            <div title="Ukuran kepadatan dan pemisahan klaster pada titik terklaster (−1 hingga 1).">
              <span>Skor Silhouette</span>
              <strong className="tabular-nums">{selectedExperiment.silhouette_score != null && Number.isFinite(selectedExperiment.silhouette_score) ? formatNumber(selectedExperiment.silhouette_score, 4) : '—'}</strong>
            </div>
            <div title="Konsistensi jumlah klaster terhadap kombinasi parameter tetangga pada grid (0 hingga 1).">
              <span>Skor Stabilitas</span>
              <strong className="tabular-nums">{selectedExperiment.stability_score != null && Number.isFinite(selectedExperiment.stability_score) ? formatNumber(selectedExperiment.stability_score, 4) : '—'}</strong>
            </div>
            <div title="Nilai gabungan multikriteria khusus eksperimen berstatus Valid.">
              <span>Skor Rekomendasi</span>
              <strong className="tabular-nums">{selectedExperiment.recommendation_score != null && Number.isFinite(selectedExperiment.recommendation_score) ? formatNumber(selectedExperiment.recommendation_score, 4) : '—'}</strong>
            </div>
          </div>
          <div className="final-method-note">
            <Database size={15} />
            <span>Dataset #{selectedExperiment.dataset_id} · Proses Pencarian Parameter #{selectedExperiment.job_id}</span>
          </div>
        </div> : <StatePanel type="empty" title="Belum ada eksperimen dipilih" message={sourceLoading ? 'Menunggu pemeriksaan proses dan eksperimen.' : 'Pilih proses Pencarian Parameter yang berhasil dari daftar di sebelah kiri.'} />}

        {matchingExperiments.length > 0 && <div className="final-experiment-list-wrap">
          <div className="final-experiment-list-heading">
            <div>
              <strong>Daftar Eksperimen</strong>
              <span className="final-experiment-count-text">
                Menampilkan {displayedExperiments.length} dari {matchingExperiments.length} eksperimen ({validExperiments.length} valid)
              </span>
            </div>
            {hasAnyValid && (
              <div className="final-filter-pills" role="tablist">
                <button
                  type="button"
                  className={`final-filter-pill ${filterMode === 'VALID_ONLY' ? 'active' : ''}`}
                  onClick={() => setFilterMode('VALID_ONLY')}
                >
                  Hanya Valid ({validExperiments.length})
                </button>
                <button
                  type="button"
                  className={`final-filter-pill ${filterMode === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterMode('ALL')}
                >
                  Semua ({matchingExperiments.length})
                </button>
              </div>
            )}
          </div>

          <div className="final-experiment-scroll-box">
            <div className="experiment-list">
              {displayedExperiments.map((item) => {
                const isItemValid = item.is_valid === true;
                const isSelected = experimentId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`experiment-option ${isSelected ? 'selected' : ''} ${!isItemValid ? 'invalid' : ''}`}
                    onClick={() => setExperimentId(item.id)}
                  >
                    <span className="experiment-radio" />
                    <span className="experiment-main">
                      <strong>
                        Eksperimen #{item.id}
                        {item.is_recommended && <span className="recommended-label" style={{ fontSize: '0.68rem', marginLeft: '6px' }}>Direkomendasikan</span>}
                      </strong>
                      <small className="tabular-nums">
                        ε {formatNumber(item.eps_km, 2)} km · MinPts {item.min_samples} · Klaster: {formatNumber(item.cluster_count)}
                      </small>
                    </span>
                    <span className="experiment-score tabular-nums">
                      {item.recommendation_score != null && Number.isFinite(item.recommendation_score)
                        ? formatNumber(item.recommendation_score, 4)
                        : (item.silhouette_score != null && Number.isFinite(item.silhouette_score) ? formatNumber(item.silhouette_score, 4) : '—')}
                      <small>{item.recommendation_score != null ? 'Skor Rekomendasi' : 'Skor Silhouette'}</small>
                    </span>
                    <StatusBadge status={item.is_valid === true ? 'VALID' : item.is_valid === false ? 'INVALID' : 'HISTORIS'} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>}
      </GlassCard>
    </div>

    <GlassCard title="Kemajuan DBSCAN Final" subtitle="Status proses dipulihkan otomatis. Proses yang masih berjalan dipantau; memuat ulang halaman tidak menghapus pemantauan pada tab ini.">
      {jobId ? jobState.error && !currentFinalJob ? <div className="final-job-error-state">
        <StatePanel type="error" title="Status proses tidak tersedia" message={jobState.error} action={<div className="final-job-error-actions"><button className="button button-secondary" type="button" onClick={jobState.reload}><RefreshCw size={13} /> Coba lagi</button><Link className="button button-secondary" to="/admin/jobs"><ListTodo size={14} /> Buka Manajemen Proses</Link></div>} />
        <button className="text-button" type="button" onClick={() => setShowClearModal(true)}>Hentikan pemantauan pada tab ini <ExternalLink size={12} /></button>
      </div> : currentFinalJob ? <div className="job-progress">
        <div className="job-progress-head"><div><span className="eyebrow">PROSES #{jobId} · EKSEKUSI #{resolvedRunId ?? '—'}</span><h3>Klasterisasi Final</h3></div><StatusBadge status={currentFinalJob.status} /></div>
        <div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, currentFinalJob.progress || 0))}%` }} /></div>
        <div className="progress-label"><strong>{formatNumber(currentFinalJob.progress || 0)}%</strong><span>{currentFinalJob.current_step ? processStepLabel(currentFinalJob.current_step) : currentFinalJob.message || 'Menunggu pembaruan status'}</span></div>
        <div className="final-job-meta"><span>Dataset #{currentFinalJob.dataset_id}</span><span>Dibuat {formatDate(currentFinalJob.created_at)}</span><span>{currentFinalJob.finished_at ? `Selesai ${formatDate(currentFinalJob.finished_at)}` : `Mulai ${formatDate(currentFinalJob.started_at)}`}</span></div>
        {currentFinalJob.status === 'FAILED' && <div className="form-error">{friendlyErrorMessage(currentFinalJob.error_code || 'JOB_FAILED')} {currentFinalJob.message ? `· ${friendlyErrorMessage(currentFinalJob.message)}` : ''}</div>}
        {currentFinalJob.status === 'SUCCESS' && <div className="success-panel"><CheckCircle2 size={17} /><div><strong>Proses berhasil diselesaikan</strong><span>Periksa rincian hasil pada Riwayat Eksekusi sebelum mengaktifkannya.</span></div></div>}
        {currentFinalJob.status === 'SUCCESS' && <Link className="button button-secondary final-run-link" to="/admin/riwayat-run"><Database size={14} /> Buka Riwayat Eksekusi <ArrowRight size={13} /></Link>}
        {currentFinalJob.status === 'FAILED' && <p className="subtle-copy">Proses gagal. Periksa keterangannya pada Manajemen Proses sebelum menjalankan proses baru.</p>}
        <JobLifecycleControls job={currentFinalJob} onJobChanged={jobState.reload} onRestarted={(newJobId) => { setSelectedDatasetId(currentFinalJob.dataset_id); setJobId(newJobId); setRunId(null); }} />
      </div> : <StatePanel type="loading" title="Memulihkan status proses" message="Mengambil status proses terakhir." />
        : <StatePanel type="info" title="Belum ada proses DBSCAN Final" message="Setelah permintaan diterima, status dan progres akan ditampilkan serta disimpan agar dapat dipulihkan setelah halaman dimuat ulang." />}
    </GlassCard>

    <div className="admin-note"><Clock3 size={16} /><span>DBSCAN Final tidak mengulang Pencarian Parameter. Gunakan hasil eksperimen yang sudah tersimpan; status proses dan hasil eksekusi tetap dikelola oleh sistem.</span></div>

    <ConfirmModal
      isOpen={showClearModal}
      variant="danger"
      title="Hentikan Pemantauan di Tab Ini"
      icon={<AlertTriangle size={22} />}
      confirmLabel="Ya, Hentikan Pemantauan"
      cancelLabel="Batal"
      onCancel={() => setShowClearModal(false)}
      onConfirm={handleConfirmClearTracking}
      message={
        <div>
          <p>
            Tindakan ini hanya menghapus ID pemantauan proses dari tab browser Anda saat ini.
          </p>
          <p style={{ marginTop: '8px', color: '#ffb3c0', fontSize: '12px' }}>
            Proses yang berjalan di server <strong>TIDAK dibatalkan</strong>. Lanjutkan hanya jika Anda sudah memastikan tidak ada Klasterisasi Final yang masih berjalan di Manajemen Proses.
          </p>
        </div>
      }
    />
  </div>;
}
