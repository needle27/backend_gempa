import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  FlaskConical,
  Info,
  Play,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';
import { ElbowAnalysisPanel } from '../../components/ElbowAnalysisPanel';
import { JobLifecycleControls } from '../../components/JobLifecycleControls';
import { ApiError } from '../../types/api';
import { getDatasets, getExperiments, startParameterSearch } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { usePipeline } from '../../context/PipelineContext';
import { useJobPolling } from '../../hooks/useJobPolling';
import { useResource } from '../../hooks/useResource';
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SimulationTag,
  StatePanel,
  StatusBadge,
  formatNumber,
} from '../../components/ui';
import type { ParameterExperiment } from '../../types/domain';
import { resolveExperimentProvenance } from '../../utils/parameterSearchMetadata';
import {
  formatInvalidReason,
  formatPercent,
  formatRatioPercent,
  friendlyErrorMessage,
  jobTypeLabel,
  processStepLabel,
  statusLabel,
} from '../../utils/presentation';

function parseNumberList(value: string): number[] | null {
  if (!value.trim()) return [];
  const parts = value.split(',').map((part) => part.trim());
  if (parts.some((part) => !part)) return null;
  const numbers = parts.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

export function ParameterSearchPage() {
  const navigate = useNavigate();
  const datasets = useResource(getDatasets, []);
  const { selectedDatasetId, setSelectedDatasetId, parameterJobId, setParameterJobId } = usePipeline();
  const [minSamplesText, setMinSamplesText] = useState('75, 100, 125, 150');
  const [sensitivityText, setSensitivityText] = useState('-20, -10, 0, 10, 20');
  const [epsCandidatesText, setEpsCandidatesText] = useState('17.5, 22.5, 27.5, 32.5, 35.0, 37.5');
  const [useDefaultGrid, setUseDefaultGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<ParameterExperiment[] | null>(null);
  const [experimentError, setExperimentError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'RECOMMENDED'>('ALL');
  const [sortField, setSortField] = useState<'DEFAULT' | 'SCORE' | 'SILHOUETTE' | 'EPS' | 'MINPTS'>('DEFAULT');

  const effectiveDatasetId = selectedDatasetId ?? datasets.data?.[0]?.id ?? null;
  const effectiveDatasetName = datasets.data?.find((dataset) => dataset.id === effectiveDatasetId)?.dataset_name;
  const jobState = useJobPolling(parameterJobId);
  const currentParameterJob = jobState.job?.id === parameterJobId ? jobState.job : null;
  const jobMetadata = currentParameterJob?.parameter_search_metadata ?? null;

  const recStatus =
    currentParameterJob?.recommendation_status ??
    jobMetadata?.recommendation_status ??
    jobMetadata?.recommendation?.status ??
    null;
  const selectedExp =
    currentParameterJob?.selected_experiment ??
    jobMetadata?.selected_experiment ??
    jobMetadata?.recommendation?.selected_experiment ??
    null;
  const recWeights =
    currentParameterJob?.recommendation_weights ??
    jobMetadata?.recommendation_weights ??
    jobMetadata?.recommendation?.recommendation_weights ??
    null;
  const validityThresh =
    currentParameterJob?.validity_thresholds ??
    jobMetadata?.validity_thresholds ??
    null;
  const kneeSummary =
    currentParameterJob?.knee_summary ??
    jobMetadata?.knee_summary ??
    null;

  useEffect(() => {
    if (window.location.hash === '#elbow-analysis') {
      document.getElementById('elbow-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [parameterJobId]);

  useEffect(() => {
    let active = true;
    if (IS_PREVIEW_MODE) {
      void getExperiments(51).then((items) => { if (active) setExperiments(items); }).catch(() => { if (active) setExperiments([]); });
      return () => { active = false; };
    }
    setExperiments(null);
    setExperimentError(null);
    if (!parameterJobId || !currentParameterJob || currentParameterJob.status !== 'SUCCESS') {
      return () => { active = false; };
    }
    getExperiments(parameterJobId)
      .then((items) => { if (active) setExperiments(items); })
      .catch((reason) => { if (active) setExperimentError(reason instanceof Error ? reason.message : 'Eksperimen belum tersedia.'); });
    return () => { active = false; };
  }, [parameterJobId, currentParameterJob?.id, currentParameterJob?.status]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveDatasetId) return;
    const minSamples = parseNumberList(minSamplesText);
    const sensitivity = parseNumberList(sensitivityText);
    const epsCandidates = parseNumberList(epsCandidatesText);
    if (!minSamples || !minSamples.length || minSamples.some((n) => !Number.isInteger(n) || n < 2)) {
      setError('Kandidat MinPts wajib diisi dengan bilangan bulat minimal 2 dan dipisahkan koma.'); return;
    }
    if (!sensitivity || sensitivity.some((n) => !Number.isFinite(n))) {
      setError('Persentase sensitivitas harus berupa angka yang dipisahkan koma.'); return;
    }
    if (epsCandidates === null || epsCandidates.some((n) => !Number.isFinite(n) || n <= 0)) {
      setError('Kandidat Epsilon harus berupa angka positif dalam kilometer.'); return;
    }
    if (!sensitivity.length) {
      setError('Persentase sensitivitas wajib diisi.'); return;
    }
    if (!useDefaultGrid && !epsCandidates.length && !sensitivity.length) {
      setError('Aktifkan default grid atau masukkan sumber kandidat epsilon.'); return;
    }
    setBusy(true); setError(null); setExperiments(null); setExperimentError(null);
    try {
      const result = await startParameterSearch(effectiveDatasetId, minSamples, sensitivity, epsCandidates.length ? epsCandidates : null, useDefaultGrid);
      setParameterJobId(result.job_id);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && reason.code === 'JOB_ALREADY_RUNNING') {
        const existingJobId = Number(reason.details?.job_id);
        if (Number.isFinite(existingJobId) && existingJobId > 0) { setParameterJobId(existingJobId); setError(`Proses yang sedang berjalan ditemukan: #${existingJobId}. Statusnya sedang dipantau.`); }
        else setError(reason.message);
      } else setError(reason instanceof Error ? reason.message : 'Pencarian Parameter gagal dikirim.');
    } finally { setBusy(false); }
  };

  const validCount = useMemo(() => experiments?.filter((item) => item.is_valid).length ?? 0, [experiments]);
  const recommendedCount = useMemo(() => experiments?.filter((item) => item.is_recommended).length ?? 0, [experiments]);

  const filteredAndSortedExperiments = useMemo(() => {
    if (!experiments) return [];
    let list = [...experiments];

    if (filterMode === 'VALID') {
      list = list.filter((item) => item.is_valid);
    } else if (filterMode === 'RECOMMENDED') {
      list = list.filter((item) => item.is_recommended);
    }

    list.sort((a, b) => {
      if (sortField === 'DEFAULT') {
        if (a.is_recommended !== b.is_recommended) {
          return a.is_recommended ? -1 : 1;
        }
        const scoreA = a.recommendation_score ?? -1;
        const scoreB = b.recommendation_score ?? -1;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        const silA = a.silhouette_score ?? -2;
        const silB = b.silhouette_score ?? -2;
        if (silA !== silB) {
          return silB - silA;
        }
        if (a.min_samples !== b.min_samples) {
          return a.min_samples - b.min_samples;
        }
        return a.eps_km - b.eps_km;
      }
      if (sortField === 'SCORE') {
        return (b.recommendation_score ?? -1) - (a.recommendation_score ?? -1);
      }
      if (sortField === 'SILHOUETTE') {
        return (b.silhouette_score ?? -2) - (a.silhouette_score ?? -2);
      }
      if (sortField === 'EPS') {
        return a.eps_km - b.eps_km;
      }
      if (sortField === 'MINPTS') {
        return a.min_samples - b.min_samples;
      }
      return 0;
    });

    return list;
  }, [experiments, filterMode, sortField]);

  return (
    <div className="page-stack parameter-search-page">
      <PageHeader
        eyebrow="ADMIN / PERANCANGAN EKSPERIMEN"
        title="Pencarian Parameter"
        description="Kirim kandidat parameter untuk diuji dan pantau kemajuan proses eksperimen klasterisasi."
        action={<SimulationTag />}
      />

      <div className="parameter-layout parameter-search-layout">
        <GlassCard
          title="Konfigurasi pencarian"
          subtitle="MinPts wajib diisi. Epsilon dievaluasi melalui deteksi knee, kandidat eksplisit, dan default grid backend."
        >
          <form className="stack-form" onSubmit={submit}>
            <label>
              Dataset
              <select
                value={effectiveDatasetId ?? ''}
                onChange={(event) => setSelectedDatasetId(Number(event.target.value) || null)}
                disabled={datasets.loading || !datasets.data?.length}
              >
                <option value="">Pilih dataset</option>
                {datasets.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.dataset_name} · {statusLabel(item.status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kandidat MinPts
              <input
                value={minSamplesText}
                onChange={(event) => setMinSamplesText(event.target.value)}
                placeholder="Contoh format: 75, 100, 125, 150"
              />
            </label>
            <label>
              Persentase sensitivitas
              <input
                value={sensitivityText}
                onChange={(event) => setSensitivityText(event.target.value)}
                placeholder="Contoh: -20, -10, 0, 10, 20"
              />
            </label>
            <label>
              Kandidat Epsilon eksplisit (km)
              <input
                value={epsCandidatesText}
                onChange={(event) => setEpsCandidatesText(event.target.value)}
                placeholder="Opsional, misalnya: 17.5, 22.5, 27.5, 32.5, 35.0, 37.5"
              />
            </label>
            <label className="parameter-grid-toggle">
              <input
                type="checkbox"
                checked={useDefaultGrid}
                onChange={(event) => setUseDefaultGrid(event.target.checked)}
              />{' '}
              Gunakan default epsilon grid backend (10, 15, 20, 25, 30, 40, 50, 60, 75, 100 km)
            </label>
            <div className="inline-notice">
              <SlidersHorizontal size={15} /> Backend menggabungkan kandidat dari knee sensitivity, epsilon eksplisit,
              dan default grid yang diaktifkan. Epsilon dibulatkan dan dideduplikasi oleh backend; frontend tidak
              menghitung atau mengonversi epsilon.
            </div>
            <div className="inline-notice">
              Konfigurasi backend BE 4.1: Haversine dengan jari-jari bumi 6371,0088 km; mode cross (seluruh epsilon ×
              seluruh MinPts); evaluasi validitas multikriteria (jumlah klaster 2–80, noise ≤ 40%, dominasi klaster ≤ 60%).
            </div>
            {IS_PREVIEW_MODE && (
              <div className="inline-notice">
                <span className="notice-dot" />
                Mode Pratinjau: pencarian parameter tidak dikirim ke server.
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <PrimaryButton
              type="submit"
              disabled={
                IS_PREVIEW_MODE ||
                busy ||
                !effectiveDatasetId ||
                !['READY', 'PROCESSED'].includes(
                  datasets.data?.find((dataset) => dataset.id === effectiveDatasetId)?.status || '',
                )
              }
            >
              {busy ? 'Mengirim permintaan…' : <><Play size={15} /> Jalankan Pencarian Parameter</>}
            </PrimaryButton>
          </form>
        </GlassCard>

        <GlassCard
          title="Status pencarian"
          subtitle="Permintaan yang diterima akan masuk antrean worker Celery dan diproses secara sekuensial."
        >
          {parameterJobId ? (
            jobState.error ? (
              <StatePanel type="error" title="Status proses gagal dimuat" message={jobState.error} />
            ) : jobState.job ? (
              <div className="job-progress">
                <div className="job-progress-head">
                  <div>
                    <span className="eyebrow">PROSES #{jobState.job.id}</span>
                    <h3>{jobTypeLabel(jobState.job.job_type)}</h3>
                  </div>
                  <StatusBadge status={jobState.job.status} />
                </div>
                <div className="progress-track">
                  <span style={{ width: `${Math.max(0, Math.min(100, jobState.job.progress))}%` }} />
                </div>
                <div className="progress-label">
                  <strong>{formatNumber(jobState.job.progress)}%</strong>
                  <span>
                    {jobState.job.current_step
                      ? processStepLabel(jobState.job.current_step)
                      : jobState.job.message || 'Menunggu pembaruan status'}
                  </span>
                </div>
                {jobState.job.message && <p className="subtle-copy">{friendlyErrorMessage(jobState.job.message)}</p>}
                {jobState.job.status === 'FAILED' && (
                  <div className="form-error">
                    {friendlyErrorMessage(jobState.job.error_code || 'JOB_FAILED')}{' '}
                    {jobState.job.message ? `· ${friendlyErrorMessage(jobState.job.message)}` : ''}
                  </div>
                )}
                <JobLifecycleControls
                  job={jobState.job}
                  onJobChanged={jobState.reload}
                  onRestarted={(newJobId) => {
                    setExperiments(null);
                    setExperimentError(null);
                    if (currentParameterJob) setSelectedDatasetId(currentParameterJob.dataset_id);
                    setParameterJobId(newJobId);
                  }}
                />
              </div>
            ) : (
              <StatePanel type="loading" title="Menghubungkan ke proses" message="Mengambil status proses." />
            )
          ) : (
            <StatePanel
              type="info"
              title="Belum ada proses aktif"
              message="Setelah permintaan diterima, status dan kemajuan proses akan ditampilkan di panel ini."
            />
          )}
        </GlassCard>
      </div>

      {/* REKOMENDASI MULTIKRITERIA HERO CARD */}
      {currentParameterJob?.status === 'SUCCESS' && (
        <>
          {recStatus === 'RECOMMENDED' && selectedExp ? (
            <GlassCard className="recommendation-card">
              <div className="recommendation-heading">
                <div>
                  <span className="eyebrow">REKOMENDASI METODOLOGIS BE 4.1</span>
                  <h3>Parameter Rekomendasi Terpilih (Eksperimen #{selectedExp.id})</h3>
                </div>
                <StatusBadge status="RECOMMENDED" />
              </div>

              <div className="recommendation-grid">
                <div className="recommendation-item">
                  <span>Epsilon (ε)</span>
                  <strong>{formatNumber(selectedExp.eps_km, 2)} km</strong>
                  <small>Jarak Haversine</small>
                </div>
                <div className="recommendation-item">
                  <span>MinPts</span>
                  <strong>{formatNumber(selectedExp.min_samples)}</strong>
                  <small>Titik minimum</small>
                </div>
                <div className="recommendation-item">
                  <span>Jumlah Klaster</span>
                  <strong>{formatNumber(selectedExp.cluster_count)}</strong>
                  <small>Klaster spasial</small>
                </div>
                <div className="recommendation-item">
                  <span>Persentase Noise</span>
                  <strong>{formatPercent(selectedExp.noise_percentage, 2)}</strong>
                  <small>Titik terisolasi</small>
                </div>
                <div className="recommendation-item">
                  <span>Dominasi Klaster</span>
                  <strong>
                    {selectedExp.largest_cluster_ratio != null
                      ? formatRatioPercent(selectedExp.largest_cluster_ratio, 1)
                      : '—'}
                  </strong>
                  <small>
                    {selectedExp.max_cluster_size != null
                      ? `Maks ${formatNumber(selectedExp.max_cluster_size)} titik`
                      : 'Klaster terbesar'}
                  </small>
                </div>
                <div className="recommendation-item">
                  <span>Skor Silhouette</span>
                  <strong>{formatNumber(selectedExp.silhouette_score, 4)}</strong>
                  <small>Kerapatan klaster</small>
                </div>
                <div className="recommendation-item">
                  <span>Skor Stabilitas</span>
                  <strong>{formatNumber(selectedExp.stability_score, 4)}</strong>
                  <small>Stabilitas tetangga grid</small>
                </div>
                <div className="recommendation-item">
                  <span>Skor Rekomendasi</span>
                  <strong>{formatNumber(selectedExp.recommendation_score, 4)}</strong>
                  <small>Skor gabungan multikriteria</small>
                </div>
              </div>

              <div className="recommendation-actions">
                <p>
                  Eksperimen #{selectedExp.id} merupakan satu-satunya pemenang skoring multikriteria terbobot
                  (Silhouette 40%, Noise 20%, Dominasi 20%, Stabilitas 20%) dan telah memenuhi seluruh kriteria validitas
                  tanpa ambiguitas.
                </p>
                <PrimaryButton
                  onClick={() => {
                    if (effectiveDatasetId) setSelectedDatasetId(effectiveDatasetId);
                    setParameterJobId(currentParameterJob.id);
                    navigate('/admin/dbscan-final');
                  }}
                >
                  <Workflow size={15} /> Lanjut ke DBSCAN Final <ArrowRight size={14} />
                </PrimaryButton>
              </div>
            </GlassCard>
          ) : recStatus === 'NO_VALID_EXPERIMENT' ? (
            <div className="final-block-notice">
              <AlertTriangle size={18} />
              <div>
                <strong>Tidak Ada Kombinasi Parameter yang Memenuhi Kriteria Validitas</strong>
                <p>
                  Seluruh kombinasi parameter yang diuji menghasilkan jumlah klaster, persentase noise, atau dominasi
                  klaster di luar ambang batas validitas metodologi BE 4.1. Tidak ada eksperimen yang direkomendasikan
                  untuk klasterisasi final.
                </p>
              </div>
            </div>
          ) : (
            <div className="inline-notice">
              <Info size={15} /> Status rekomendasi multikriteria belum tersedia untuk proses ini (job historis sebelum T8).
            </div>
          )}
        </>
      )}

      {/* RINGKASAN DETEKSI KNEE PER MINPTS */}
      {kneeSummary && kneeSummary.length > 0 && (
        <GlassCard
          title="Ringkasan Deteksi Knee (p95 per MinPts)"
          subtitle="Nilai Epsilon knee dan persentil jarak k-distance untuk setiap kandidat MinPts yang dianalisis."
        >
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>MinPts</th>
                  <th>ε Knee (km)</th>
                  <th>p90 (km)</th>
                  <th>p95 (km)</th>
                  <th>p98 (km)</th>
                  <th>Status Deteksi</th>
                </tr>
              </thead>
              <tbody>
                {kneeSummary.map((item) => (
                  <tr key={item.min_samples}>
                    <td><strong>{item.min_samples}</strong></td>
                    <td>{item.knee_eps_km != null ? `${formatNumber(item.knee_eps_km, 2)} km` : '—'}</td>
                    <td>{item.p90_km != null ? `${formatNumber(item.p90_km, 2)} km` : '—'}</td>
                    <td>{item.p95_km != null ? `${formatNumber(item.p95_km, 2)} km` : '—'}</td>
                    <td>{item.p98_km != null ? `${formatNumber(item.p98_km, 2)} km` : '—'}</td>
                    <td>
                      <StatusBadge
                        status={item.detected || item.status === 'DETECTED' ? 'SUCCESS' : 'INVALID'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* TRANSPARANSI METODOLOGI: AMBANG BATAS & BOBOT */}
      {(validityThresh || recWeights) && (
        <details className="transparency-details">
          <summary>Transparansi Metodologi: Ambang Batas Validitas & Bobot Rekomendasi (BE 4.1)</summary>
          <div className="transparency-grid">
            {validityThresh && (
              <div className="transparency-box">
                <h4>Ambang Batas Validitas (T6)</h4>
                <ul>
                  <li>
                    <span>Jumlah Klaster Minimum</span>
                    <strong>{validityThresh.min_clusters} klaster</strong>
                  </li>
                  <li>
                    <span>Jumlah Klaster Maksimum</span>
                    <strong>{validityThresh.max_clusters} klaster</strong>
                  </li>
                  <li>
                    <span>Persentase Noise Maksimum</span>
                    <strong>{formatPercent(validityThresh.max_noise_percentage, 1)}</strong>
                  </li>
                  <li>
                    <span>Dominasi Klaster Maksimum</span>
                    <strong>{formatRatioPercent(validityThresh.max_largest_cluster_ratio, 1)}</strong>
                  </li>
                </ul>
              </div>
            )}
            {recWeights && (
              <div className="transparency-box">
                <h4>Bobot Multikriteria Rekomendasi (T8)</h4>
                <ul>
                  <li>
                    <span>Skor Silhouette</span>
                    <strong>{formatRatioPercent(recWeights.silhouette, 0)} <small>(Makin tinggi makin baik)</small></strong>
                  </li>
                  <li>
                    <span>Persentase Noise</span>
                    <strong>{formatRatioPercent(recWeights.noise_percentage, 0)} <small>(Makin rendah makin baik)</small></strong>
                  </li>
                  <li>
                    <span>Dominasi Klaster</span>
                    <strong>{formatRatioPercent(recWeights.largest_cluster_ratio, 0)} <small>(Makin rendah makin baik)</small></strong>
                  </li>
                  <li>
                    <span>Skor Stabilitas Grid</span>
                    <strong>{formatRatioPercent(recWeights.stability_score, 0)} <small>(Makin tinggi makin baik)</small></strong>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* METADATA AKTUAL DARI JOB */}
      {jobMetadata && (
        <GlassCard title="Konfigurasi aktual backend" subtitle="Konfigurasi aktual dari detail job backend.">
          <div className="metadata-grid">
            <div><strong>Versi metode</strong><p>{jobMetadata.method_version ?? '—'}</p></div>
            <div><strong>Mode kombinasi</strong><p>{jobMetadata.combination_mode ?? '—'}</p></div>
            <div><strong>Jumlah kandidat epsilon</strong><p>{jobMetadata.epsilon_candidate_count ?? '—'}</p></div>
            <div>
              <strong>Pembulatan epsilon</strong>
              <p>
                {(jobMetadata.epsilon_rounding_km ?? jobMetadata.rounding_km) != null
                  ? `${jobMetadata.epsilon_rounding_km ?? jobMetadata.rounding_km} km`
                  : '—'}
              </p>
            </div>
            <div><strong>Default grid (km)</strong><p>{(jobMetadata.default_grid_km ?? jobMetadata.default_grid)?.join(', ') || '—'}</p></div>
            <div><strong>Kandidat epsilon aktual (km)</strong><p>{jobMetadata.epsilon_candidates_km?.join(', ') || '—'}</p></div>
            <div><strong>Sensitivitas (%)</strong><p>{jobMetadata.sensitivity_percentages?.join(', ') || '—'}</p></div>
            <div>
              <strong>Jumlah kandidat per sumber</strong>
              <p>
                {jobMetadata.source_candidate_counts
                  ? Object.entries(jobMetadata.source_candidate_counts).map(([key, value]) => `${key}: ${value}`).join(' · ')
                  : '—'}
              </p>
            </div>
            <div><strong>Strategi kandidat epsilon</strong><p>{jobMetadata.epsilon_candidate_strategy ?? '—'}</p></div>
            <div><strong>Kombinasi diuji</strong><p>{jobMetadata.combination_count ?? '—'}</p></div>
            <div><strong>MinPts kandidat</strong><p>{jobMetadata.min_samples_candidates?.join(', ') || '—'}</p></div>
            <div><strong>Grid default digunakan</strong><p>{jobMetadata.use_default_grid == null ? '—' : jobMetadata.use_default_grid ? 'Ya' : 'Tidak'}</p></div>
            <div>
              <strong>Status kandidat</strong>
              <p>
                {typeof jobMetadata.candidate_status === 'string'
                  ? jobMetadata.candidate_status
                  : jobMetadata.candidate_status
                    ? JSON.stringify(jobMetadata.candidate_status)
                    : '—'}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <ElbowAnalysisPanel
        jobMetadata={currentParameterJob?.parameter_search_metadata ?? null}
        jobId={parameterJobId}
        datasetId={effectiveDatasetId}
        datasetName={effectiveDatasetName}
        jobStatus={currentParameterJob?.status}
        experiments={experiments}
      />

      {/* TABEL HASIL EKSPERIMEN LENGKAP */}
      <GlassCard
        title="Seluruh hasil eksperimen"
        subtitle="Seluruh hasil dievaluasi dengan kriteria validitas metodologis BE 4.1 dan skoring multikriteria terbobot."
      >
        {experimentError ? (
          <StatePanel type="error" title="Eksperimen belum tersedia" message={experimentError} />
        ) : experiments?.length ? (
          <>
            <div className="table-filter-bar">
              <div className="filter-button-group">
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterMode('ALL')}
                >
                  Semua ({experiments.length})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'VALID' ? 'active' : ''}`}
                  onClick={() => setFilterMode('VALID')}
                >
                  Hanya Valid ({validCount})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'RECOMMENDED' ? 'active' : ''}`}
                  onClick={() => setFilterMode('RECOMMENDED')}
                >
                  Direkomendasikan ({recommendedCount})
                </button>
              </div>

              <div className="sort-selector">
                <Filter size={13} />
                <span>Urutkan:</span>
                <select
                  value={sortField}
                  onChange={(event) =>
                    setSortField(event.target.value as 'DEFAULT' | 'SCORE' | 'SILHOUETTE' | 'EPS' | 'MINPTS')
                  }
                >
                  <option value="DEFAULT">Urutan Default (Rekomendasi & Skor)</option>
                  <option value="SCORE">Skor Rekomendasi Tertinggi</option>
                  <option value="SILHOUETTE">Skor Silhouette Tertinggi</option>
                  <option value="EPS">Epsilon (Terkecil ke Terbesar)</option>
                  <option value="MINPTS">MinPts (Terkecil ke Terbesar)</option>
                </select>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ε (km)</th>
                    <th>MinPts</th>
                    <th>Klaster</th>
                    <th>Persentase Noise</th>
                    <th>Dominasi Klaster</th>
                    <th>Silhouette</th>
                    <th>Stabilitas</th>
                    <th>Skor Rekomendasi</th>
                    <th>Validitas</th>
                    <th>Rekomendasi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedExperiments.map((item) => {
                    const provenance = resolveExperimentProvenance(item, jobMetadata);
                    const isHistorical = item.invalid_reasons === null && item.stability_score === null;

                    return (
                      <tr key={item.id} className={item.is_recommended ? 'job-row-recommended' : ''}>
                        <td>#{item.id}</td>
                        <td>
                          <strong>{formatNumber(item.eps_km, 2)}</strong>
                          {provenance.epsSources?.map((src) => (
                            <span key={src} className="source-tag">
                              {src.startsWith('knee') ? 'Knee' : src.startsWith('grid') || src === 'default_grid' ? 'Grid' : src}
                            </span>
                          ))}
                        </td>
                        <td>{item.min_samples}</td>
                        <td>{formatNumber(item.cluster_count)}</td>
                        <td>{formatPercent(item.noise_percentage, 2)}</td>
                        <td>
                          <span>
                            {item.largest_cluster_ratio != null
                              ? formatRatioPercent(item.largest_cluster_ratio, 1)
                              : '—'}
                          </span>
                          {item.max_cluster_size != null && (
                            <small className="table-sub">Maks: {formatNumber(item.max_cluster_size)} titik</small>
                          )}
                        </td>
                        <td>{item.silhouette_score != null ? formatNumber(item.silhouette_score, 4) : '—'}</td>
                        <td>{item.stability_score != null ? formatNumber(item.stability_score, 4) : '—'}</td>
                        <td>
                          {item.recommendation_score != null ? (
                            <strong>{formatNumber(item.recommendation_score, 4)}</strong>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {isHistorical ? (
                            <StatusBadge status="HISTORIS" />
                          ) : item.is_valid ? (
                            <StatusBadge status="VALID" />
                          ) : (
                            <div className="invalid-cell">
                              <StatusBadge status="INVALID" />
                              <small className="invalid-subtext">
                                {item.invalid_reasons && item.invalid_reasons.length > 0
                                  ? item.invalid_reasons.map(formatInvalidReason).join('; ')
                                  : item.invalid_reason || 'Tidak memenuhi ambang batas'}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          {item.is_recommended ? (
                            <span className="recommended-label">Direkomendasikan</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <StatePanel
            type="empty"
            title="Belum ada hasil eksperimen"
            message="Hasil akan muncul setelah proses Pencarian Parameter selesai."
          />
        )}
      </GlassCard>

      <div className="admin-note">
        <FlaskConical size={16} />
        <span>
          Penanda rekomendasi dan skor multikriteria merupakan hasil evaluasi analitis objektif BE 4.1 untuk membantu
          pengambilan keputusan metodologi penelitian DBSCAN Gempa Indonesia.
        </span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}
