import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  FlaskConical,
  Info,
  Play,
  Sparkles,
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
import { useI18n } from '../../i18n/LanguageContext';
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
  const { lang, tx } = useI18n();
  const navigate = useNavigate();
  const datasets = useResource(getDatasets, []);
  const { selectedDatasetId, setSelectedDatasetId, parameterJobId, setParameterJobId } = usePipeline();
  const [minSamplesText, setMinSamplesText] = useState('100, 150, 195, 200');
  const [sensitivityText, setSensitivityText] = useState('-20, -10, 0, 10, 20');
  const [epsCandidatesText, setEpsCandidatesText] = useState('17.5, 22.5, 27.5, 32.5, 35.0, 37.5');
  const [useDefaultGrid, setUseDefaultGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<ParameterExperiment[] | null>(null);
  const [experimentError, setExperimentError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'RECOMMENDED'>('ALL');
  const [sortField, setSortField] = useState<'DEFAULT' | 'SCORE' | 'SILHOUETTE' | 'EPS' | 'MINPTS'>('DEFAULT');

  const parsedMinSamples = useMemo(() => {
    return minSamplesText
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 2);
  }, [minSamplesText]);

  const estimatedEpsCount = useMemo(() => {
    const sensitivities = sensitivityText
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    const explicitEps = epsCandidatesText
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const kneeSensCount = sensitivities.length > 0 ? sensitivities.length : 5;
    const defaultGridCount = useDefaultGrid ? 10 : 0;
    return Math.max(1, kneeSensCount + defaultGridCount + explicitEps.length);
  }, [sensitivityText, epsCandidatesText, useDefaultGrid]);

  const estimatedCombinations = parsedMinSamples.length * estimatedEpsCount;

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
      .catch((reason) => { if (active) setExperimentError(reason instanceof Error ? reason.message : tx('Eksperimen belum tersedia.', 'Experiments are not available yet.')); });
    return () => { active = false; };
  }, [parameterJobId, currentParameterJob?.id, currentParameterJob?.status]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveDatasetId) return;
    const minSamples = parseNumberList(minSamplesText);
    const sensitivity = parseNumberList(sensitivityText);
    const epsCandidates = parseNumberList(epsCandidatesText);
    if (!minSamples || !minSamples.length || minSamples.some((n) => !Number.isInteger(n) || n < 2)) {
      setError(tx('Kandidat MinPts wajib diisi dengan bilangan bulat minimal 2 dan dipisahkan koma.', 'MinPts candidates must be comma-separated integers of at least 2.')); return;
    }
    if (!sensitivity || sensitivity.some((n) => !Number.isFinite(n))) {
      setError(tx('Persentase sensitivitas harus berupa angka yang dipisahkan koma.', 'Sensitivity percentages must be comma-separated numbers.')); return;
    }
    if (epsCandidates === null || epsCandidates.some((n) => !Number.isFinite(n) || n <= 0)) {
      setError(tx('Kandidat Epsilon harus berupa angka positif dalam kilometer.', 'Epsilon candidates must be positive numbers in kilometers.')); return;
    }
    if (!sensitivity.length) {
      setError(tx('Persentase sensitivitas wajib diisi.', 'Sensitivity percentages are required.')); return;
    }
    if (!useDefaultGrid && !epsCandidates.length && !sensitivity.length) {
      setError(tx('Aktifkan default grid atau masukkan sumber kandidat epsilon.', 'Enable the standard grid or enter explicit epsilon candidates.')); return;
    }
    setBusy(true); setError(null); setExperiments(null); setExperimentError(null);
    try {
      const result = await startParameterSearch(effectiveDatasetId, minSamples, sensitivity, epsCandidates.length ? epsCandidates : null, useDefaultGrid);
      setParameterJobId(result.job_id);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && reason.code === 'JOB_ALREADY_RUNNING') {
        const existingJobId = Number(reason.details?.job_id);
        if (Number.isFinite(existingJobId) && existingJobId > 0) {
          setParameterJobId(existingJobId);
          setError(tx(`Proses yang sedang berjalan ditemukan: #${existingJobId}. Statusnya sedang dipantau.`, `An active job was found: #${existingJobId}. Monitoring its status.`));
        } else setError(reason.message);
      } else setError(reason instanceof Error ? reason.message : tx('Pencarian Parameter gagal dikirim.', 'Failed to submit Parameter Search.'));
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
        eyebrow={tx('ADMIN / PERANCANGAN EKSPERIMEN', 'ADMIN / EXPERIMENT DESIGN')}
        title={tx('Pencarian Parameter', 'Parameter Search')}
        description={tx('Kirim kandidat parameter untuk diuji dan pantau kemajuan proses eksperimen klasterisasi.', 'Submit parameter candidates for evaluation and monitor clustering experiment progress.')}
        action={<SimulationTag />}
      />

      <div className="parameter-layout parameter-search-layout">
        <GlassCard
          title={tx('Konfigurasi Pencarian', 'Search Configuration')}
          subtitle={tx('MinPts wajib diisi. Epsilon dievaluasi melalui deteksi knee, kandidat eksplisit, dan grid epsilon standar.', 'MinPts is required. Epsilon candidates combine knee detection, explicit inputs, and the standard epsilon grid.')}
        >
          <form className="stack-form" onSubmit={submit}>
            <label>
              Dataset
              <select
                value={effectiveDatasetId ?? ''}
                onChange={(event) => setSelectedDatasetId(Number(event.target.value) || null)}
                disabled={datasets.loading || !datasets.data?.length}
              >
                <option value="">{tx('Pilih dataset', 'Select dataset')}</option>
                {datasets.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.dataset_name} · {statusLabel(item.status, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tx('Kandidat MinPts', 'MinPts Candidates')}
              <input
                value={minSamplesText}
                onChange={(event) => setMinSamplesText(event.target.value)}
                placeholder={tx('Contoh format: 100, 150, 195, 200', 'Example: 100, 150, 195, 200')}
              />
            </label>
            <label>
              {tx('Persentase sensitivitas', 'Sensitivity Percentages')}
              <input
                value={sensitivityText}
                onChange={(event) => setSensitivityText(event.target.value)}
                placeholder={tx('Contoh: -20, -10, 0, 10, 20', 'Example: -20, -10, 0, 10, 20')}
              />
            </label>
            <label>
              {tx('Kandidat Epsilon eksplisit (km)', 'Explicit Epsilon Candidates (km)')}
              <input
                value={epsCandidatesText}
                onChange={(event) => setEpsCandidatesText(event.target.value)}
                placeholder={tx('Opsional, misalnya: 17.5, 22.5, 27.5, 32.5, 35.0, 37.5', 'Optional, e.g. 17.5, 22.5, 27.5, 32.5, 35.0, 37.5')}
              />
            </label>
            <label className="parameter-grid-toggle">
              <input
                type="checkbox"
                checked={useDefaultGrid}
                onChange={(event) => setUseDefaultGrid(event.target.checked)}
              />{' '}
              {tx('Gunakan grid epsilon standar (10–100 km)', 'Use standard epsilon grid (10–100 km)')}
            </label>
            <div className="combination-estimate-badge">
              <Sparkles size={14} />
              <span>
                {tx('Estimasi Beban:', 'Estimated Load:')} <strong>{parsedMinSamples.length} MinPts</strong> × <strong>~{estimatedEpsCount} Epsilon</strong> = <strong>~{estimatedCombinations} {tx('kombinasi evaluasi', 'evaluation combinations')}</strong>
              </span>
            </div>
            <div className="inline-notice">
              {tx('Metode: DBSCAN Haversine · Kriteria valid: 2–80 klaster, noise ≤ 40%, dominasi klaster ≤ 60%.', 'Method: Haversine DBSCAN · Validity criteria: 2–80 clusters, noise ≤ 40%, cluster dominance ≤ 60%.')}
            </div>
            {IS_PREVIEW_MODE && (
              <div className="inline-notice">
                <span className="notice-dot" />
                {tx('Mode Pratinjau: pencarian parameter tidak dikirim ke server.', 'Preview Mode: parameter search is not dispatched to the server.')}
              </div>
            )}
            {error && <div className="form-error">{friendlyErrorMessage(error, undefined, undefined, lang)}</div>}
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
              {busy ? tx('Mengirim permintaan…', 'Submitting request…') : <><Play size={15} /> {tx('Jalankan Pencarian Parameter', 'Run Parameter Search')}</>}
            </PrimaryButton>
          </form>
        </GlassCard>

        <GlassCard
          title={tx('Status Pencarian', 'Search Status')}
          subtitle={tx('Proses berjalan di latar belakang secara bertahap.', 'Execution runs asynchronously in stages.')}
        >
          {parameterJobId ? (
            jobState.error ? (
              <StatePanel type="error" title={tx('Status proses gagal dimuat', 'Failed to load job status')} message={jobState.error} />
            ) : jobState.job ? (
              <div className="job-progress">
                <div className="job-progress-head">
                  <div>
                    <span className="eyebrow">{tx('PROSES', 'JOB')} #{jobState.job.id}</span>
                    <h3>{jobTypeLabel(jobState.job.job_type, lang)}</h3>
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
                      ? processStepLabel(jobState.job.current_step, lang)
                      : jobState.job.message
                        ? friendlyErrorMessage(jobState.job.message, undefined, undefined, lang)
                        : tx('Menunggu pembaruan status', 'Waiting for status updates')}
                  </span>
                </div>
                {jobState.job.message && <p className="subtle-copy">{friendlyErrorMessage(jobState.job.message, undefined, undefined, lang)}</p>}
                {jobState.job.status === 'FAILED' && (
                  <div className="form-error">
                    {friendlyErrorMessage(jobState.job.error_code || 'JOB_FAILED', undefined, undefined, lang)}{' '}
                    {jobState.job.message ? `· ${friendlyErrorMessage(jobState.job.message, undefined, undefined, lang)}` : ''}
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
              <StatePanel type="loading" title={tx('Menghubungkan ke proses', 'Connecting to job')} message={tx('Mengambil status proses.', 'Fetching job status.')} />
            )
          ) : (
            <StatePanel
              type="info"
              title={tx('Belum ada proses aktif', 'No active job')}
              message={tx('Setelah permintaan diterima, status dan kemajuan proses akan ditampilkan di panel ini.', 'Once submitted, job progress and status updates appear here.')}
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
                  <span className="eyebrow">{tx('REKOMENDASI METODOLOGIS', 'METHODOLOGICAL RECOMMENDATION')}</span>
                  <h3>{tx(`Parameter Rekomendasi Terpilih (Eksperimen #${selectedExp.id})`, `Selected Recommended Parameters (Experiment #${selectedExp.id})`)}</h3>
                </div>
                <StatusBadge status="RECOMMENDED" />
              </div>

              <div className="recommendation-grid">
                <div className="recommendation-item">
                  <span>Epsilon (ε)</span>
                  <strong>{formatNumber(selectedExp.eps_km, 2)} km</strong>
                  <small>{tx('Jarak Haversine', 'Haversine distance')}</small>
                </div>
                <div className="recommendation-item">
                  <span>MinPts</span>
                  <strong>{formatNumber(selectedExp.min_samples)}</strong>
                  <small>{tx('Titik minimum', 'Minimum points')}</small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Jumlah Klaster', 'Cluster Count')}</span>
                  <strong>{formatNumber(selectedExp.cluster_count)}</strong>
                  <small>{tx('Klaster spasial', 'Spatial clusters')}</small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Persentase Noise', 'Noise Percentage')}</span>
                  <strong>{formatPercent(selectedExp.noise_percentage, 2)}</strong>
                  <small>{tx('Titik terisolasi', 'Isolated points')}</small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Dominasi Klaster', 'Cluster Dominance')}</span>
                  <strong>
                    {selectedExp.largest_cluster_ratio != null
                      ? formatRatioPercent(selectedExp.largest_cluster_ratio, 1)
                      : '—'}
                  </strong>
                  <small>
                    {selectedExp.max_cluster_size != null
                      ? `${tx('Maks', 'Max')} ${formatNumber(selectedExp.max_cluster_size)} ${tx('titik', 'points')}`
                      : tx('Klaster terbesar', 'Largest cluster')}
                  </small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Skor Silhouette', 'Silhouette Score')}</span>
                  <strong>{formatNumber(selectedExp.silhouette_score, 4)}</strong>
                  <small>{tx('Kerapatan klaster', 'Cluster cohesion')}</small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Skor Stabilitas', 'Stability Score')}</span>
                  <strong>{formatNumber(selectedExp.stability_score, 4)}</strong>
                  <small>{tx('Stabilitas tetangga grid', 'Grid neighbor stability')}</small>
                </div>
                <div className="recommendation-item">
                  <span>{tx('Skor Rekomendasi', 'Recommendation Score')}</span>
                  <strong>{formatNumber(selectedExp.recommendation_score, 4)}</strong>
                  <small>{tx('Skor gabungan multikriteria', 'Multi-criteria composite')}</small>
                </div>
              </div>

              <div className="recommendation-actions">
                <p>
                  {tx(
                    `Eksperimen #${selectedExp.id} merupakan satu-satunya pemenang skoring multikriteria terbobot (Silhouette 40%, Noise 20%, Dominasi 20%, Stabilitas 20%) dan telah memenuhi seluruh kriteria validitas tanpa ambiguitas.`,
                    `Experiment #${selectedExp.id} ranks top under weighted multi-criteria scoring (Silhouette 40%, Noise 20%, Dominance 20%, Stability 20%) and satisfies all validity constraints.`,
                  )}
                </p>
                <PrimaryButton
                  onClick={() => {
                    if (effectiveDatasetId) setSelectedDatasetId(effectiveDatasetId);
                    setParameterJobId(currentParameterJob.id);
                    navigate(`/admin/dbscan-final?datasetId=${effectiveDatasetId}&jobId=${currentParameterJob.id}&experimentId=${selectedExp.id}`);
                  }}
                >
                  <Workflow size={15} /> {tx('Gunakan di DBSCAN Final', 'Use in Final DBSCAN')} <ArrowRight size={14} />
                </PrimaryButton>
              </div>
            </GlassCard>
          ) : recStatus === 'NO_VALID_EXPERIMENT' ? (
            <div className="final-block-notice">
              <AlertTriangle size={18} />
              <div>
                <strong>{tx('Tidak Ada Kombinasi Parameter yang Memenuhi Kriteria Validitas', 'No Parameter Combination Satisfies Validity Criteria')}</strong>
                <p>
                  {tx(
                    'Seluruh kombinasi parameter yang diuji menghasilkan jumlah klaster, persentase noise, atau dominasi klaster di luar ambang batas kriteria validitas metodologis. Tidak ada eksperimen yang direkomendasikan untuk klasterisasi final.',
                    'All evaluated parameter combinations produced cluster counts, noise ratios, or dominance levels outside methodological validity thresholds. No candidate is recommended.',
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="inline-notice">
              <Info size={15} /> {tx('Status rekomendasi multikriteria belum tersedia untuk proses ini.', 'Multi-criteria recommendation status is unavailable for this job.')}
            </div>
          )}
        </>
      )}

      {/* RINGKASAN DETEKSI KNEE PER MINPTS */}
      {kneeSummary && kneeSummary.length > 0 && (
        <GlassCard
          title={tx('Ringkasan Deteksi Knee (p95 per MinPts)', 'Knee Detection Summary (p95 per MinPts)')}
          subtitle={tx('Nilai Epsilon knee dan persentil jarak k-distance untuk setiap kandidat MinPts yang dianalisis.', 'Detected knee Epsilon values and k-distance percentiles for each evaluated MinPts candidate.')}
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
                  <th>{tx('Status Deteksi', 'Detection Status')}</th>
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
          <summary>{tx('Transparansi Metodologi: Ambang Batas Validitas & Bobot Rekomendasi', 'Methodology Transparency: Validity Thresholds & Recommendation Weights')}</summary>
          <div className="transparency-grid">
            {validityThresh && (
              <div className="transparency-box">
                <h4>{tx('Ambang Batas Validitas', 'Validity Thresholds')}</h4>
                <ul>
                  <li>
                    <span>{tx('Jumlah Klaster Minimum', 'Minimum Clusters')}</span>
                    <strong>{validityThresh.min_clusters} {tx('klaster', 'clusters')}</strong>
                  </li>
                  <li>
                    <span>{tx('Jumlah Klaster Maksimum', 'Maximum Clusters')}</span>
                    <strong>{validityThresh.max_clusters} {tx('klaster', 'clusters')}</strong>
                  </li>
                  <li>
                    <span>{tx('Persentase Noise Maksimum', 'Maximum Noise Percentage')}</span>
                    <strong>{formatPercent(validityThresh.max_noise_percentage, 1)}</strong>
                  </li>
                  <li>
                    <span>{tx('Dominasi Klaster Maksimum', 'Maximum Cluster Dominance')}</span>
                    <strong>{formatRatioPercent(validityThresh.max_largest_cluster_ratio, 1)}</strong>
                  </li>
                </ul>
              </div>
            )}
            {recWeights && (
              <div className="transparency-box">
                <h4>{tx('Bobot Multikriteria Rekomendasi', 'Multi-Criteria Recommendation Weights')}</h4>
                <ul>
                  <li>
                    <span>{tx('Skor Silhouette', 'Silhouette Score')}</span>
                    <strong>{formatRatioPercent(recWeights.silhouette, 0)} <small>{tx('(Makin tinggi makin baik)', '(Higher is better)')}</small></strong>
                  </li>
                  <li>
                    <span>{tx('Persentase Noise', 'Noise Percentage')}</span>
                    <strong>{formatRatioPercent(recWeights.noise_percentage, 0)} <small>{tx('(Makin rendah makin baik)', '(Lower is better)')}</small></strong>
                  </li>
                  <li>
                    <span>{tx('Dominasi Klaster', 'Cluster Dominance')}</span>
                    <strong>{formatRatioPercent(recWeights.largest_cluster_ratio, 0)} <small>{tx('(Makin rendah makin baik)', '(Lower is better)')}</small></strong>
                  </li>
                  <li>
                    <span>{tx('Skor Stabilitas Grid', 'Grid Stability Score')}</span>
                    <strong>{formatRatioPercent(recWeights.stability_score, 0)} <small>{tx('(Makin tinggi makin baik)', '(Higher is better)')}</small></strong>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* METADATA AKTUAL DARI JOB */}
      {jobMetadata && (
        <GlassCard title={tx('Konfigurasi Aktual Proses', 'Actual Job Configuration')} subtitle={tx('Rincian konfigurasi parameter yang diterapkan saat proses berjalan.', 'Parameter configuration details recorded during job execution.')}>
          <div className="metadata-grid">
            <div><strong>{tx('Versi metode', 'Method version')}</strong><p>{jobMetadata.method_version ?? '—'}</p></div>
            <div><strong>{tx('Mode kombinasi', 'Combination mode')}</strong><p>{jobMetadata.combination_mode === 'cross' ? tx('Kombinasi silang', 'Cross product') : jobMetadata.combination_mode ?? '—'}</p></div>
            <div><strong>{tx('Jumlah kandidat epsilon', 'Epsilon candidate count')}</strong><p>{jobMetadata.epsilon_candidate_count ?? '—'}</p></div>
            <div>
              <strong>{tx('Pembulatan epsilon', 'Epsilon rounding')}</strong>
              <p>
                {(jobMetadata.epsilon_rounding_km ?? jobMetadata.rounding_km) != null
                  ? `${jobMetadata.epsilon_rounding_km ?? jobMetadata.rounding_km} km`
                  : '—'}
              </p>
            </div>
            <div><strong>{tx('Grid standar (km)', 'Standard grid (km)')}</strong><p>{(jobMetadata.default_grid_km ?? jobMetadata.default_grid)?.join(', ') || '—'}</p></div>
            <div><strong>{tx('Kandidat epsilon aktual (km)', 'Actual epsilon candidates (km)')}</strong><p>{jobMetadata.epsilon_candidates_km?.join(', ') || '—'}</p></div>
            <div><strong>{tx('Sensitivitas (%)', 'Sensitivity (%)')}</strong><p>{jobMetadata.sensitivity_percentages?.join(', ') || '—'}</p></div>
            <div>
              <strong>{tx('Jumlah kandidat per sumber', 'Candidates per source')}</strong>
              <p>
                {jobMetadata.source_candidate_counts
                  ? Object.entries(jobMetadata.source_candidate_counts)
                      .map(([key, value]) => {
                        const label = key === 'knee'
                          ? 'Knee'
                          : key === 'default_grid' || key === 'grid'
                            ? tx('Grid standar', 'Standard grid')
                            : key === 'explicit'
                              ? tx('Eksplisit', 'Explicit')
                              : key;
                        return `${label}: ${value}`;
                      })
                      .join(' · ')
                  : '—'}
              </p>
            </div>
            <div><strong>{tx('Strategi kandidat epsilon', 'Epsilon candidate strategy')}</strong><p>{jobMetadata.epsilon_candidate_strategy ?? '—'}</p></div>
            <div><strong>{tx('Kombinasi diuji', 'Evaluated combinations')}</strong><p>{jobMetadata.combination_count ?? '—'}</p></div>
            <div><strong>{tx('MinPts kandidat', 'MinPts candidates')}</strong><p>{jobMetadata.min_samples_candidates?.join(', ') || '—'}</p></div>
            <div><strong>{tx('Grid standar digunakan', 'Standard grid enabled')}</strong><p>{jobMetadata.use_default_grid == null ? '—' : jobMetadata.use_default_grid ? tx('Ya', 'Yes') : tx('Tidak', 'No')}</p></div>
            <div>
              <strong>{tx('Status kandidat', 'Candidate status')}</strong>
              <p>
                {typeof jobMetadata.candidate_status === 'string'
                  ? jobMetadata.candidate_status === 'RESOLVED'
                    ? tx('Terselesaikan', 'Resolved')
                    : jobMetadata.candidate_status === 'FAILED_NO_CANDIDATES'
                      ? tx('Tidak ada kandidat', 'No candidates')
                      : jobMetadata.candidate_status
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
        title={tx('Hasil Eksperimen', 'Experiment Results')}
        subtitle={tx('Seluruh hasil dievaluasi dengan kriteria validitas metodologis dan skoring multikriteria terbobot.', 'All outcomes are evaluated using methodological validity criteria and weighted multi-criteria scoring.')}
      >
        {experimentError ? (
          <StatePanel type="error" title={tx('Eksperimen belum tersedia', 'Experiments unavailable')} message={experimentError} />
        ) : experiments?.length ? (
          <>
            <div className="table-filter-bar">
              <div className="filter-button-group">
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterMode('ALL')}
                >
                  {tx('Semua', 'All')} ({experiments.length})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'VALID' ? 'active' : ''}`}
                  onClick={() => setFilterMode('VALID')}
                >
                  {tx('Hanya Valid', 'Valid Only')} ({validCount})
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filterMode === 'RECOMMENDED' ? 'active' : ''}`}
                  onClick={() => setFilterMode('RECOMMENDED')}
                >
                  {tx('Direkomendasikan', 'Recommended')} ({recommendedCount})
                </button>
              </div>

              <div className="sort-selector">
                <Filter size={13} />
                <span>{tx('Urutkan:', 'Sort:')}</span>
                <select
                  value={sortField}
                  onChange={(event) =>
                    setSortField(event.target.value as 'DEFAULT' | 'SCORE' | 'SILHOUETTE' | 'EPS' | 'MINPTS')
                  }
                >
                  <option value="DEFAULT">{tx('Urutan Default (Rekomendasi & Skor)', 'Default (Recommendation & Score)')}</option>
                  <option value="SCORE">{tx('Skor Rekomendasi Tertinggi', 'Highest Recommendation Score')}</option>
                  <option value="SILHOUETTE">{tx('Skor Silhouette Tertinggi', 'Highest Silhouette Score')}</option>
                  <option value="EPS">{tx('Epsilon (Terkecil ke Terbesar)', 'Epsilon (Ascending)')}</option>
                  <option value="MINPTS">{tx('MinPts (Terkecil ke Terbesar)', 'MinPts (Ascending)')}</option>
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
                    <th>{tx('Klaster', 'Clusters')}</th>
                    <th>{tx('Persentase Noise', 'Noise Percentage')}</th>
                    <th>{tx('Dominasi Klaster', 'Cluster Dominance')}</th>
                    <th>Silhouette</th>
                    <th>{tx('Stabilitas', 'Stability')}</th>
                    <th>{tx('Skor Rekomendasi', 'Rec. Score')}</th>
                    <th>{tx('Validitas', 'Validity')}</th>
                    <th>{tx('Rekomendasi', 'Recommendation')}</th>
                    <th>{tx('Aksi', 'Action')}</th>
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
                            <small className="table-sub">{tx('Maks:', 'Max:')} {formatNumber(item.max_cluster_size)} {tx('titik', 'points')}</small>
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
                                  ? item.invalid_reasons.map((r) => formatInvalidReason(r, jobMetadata?.validity_thresholds, lang)).join('; ')
                                  : item.invalid_reason
                                    ? formatInvalidReason(item.invalid_reason, jobMetadata?.validity_thresholds, lang)
                                    : tx('Tidak memenuhi ambang batas', 'Outside validity thresholds')}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          {item.is_recommended ? (
                            <span className="recommended-label">{tx('Direkomendasikan', 'Recommended')}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {item.is_valid ? (
                            <button
                              className="text-button"
                              type="button"
                              style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                if (effectiveDatasetId) setSelectedDatasetId(effectiveDatasetId);
                                if (currentParameterJob) setParameterJobId(currentParameterJob.id);
                                navigate(`/admin/dbscan-final?datasetId=${effectiveDatasetId}&jobId=${currentParameterJob?.id ?? ''}&experimentId=${item.id}`);
                              }}
                            >
                              {tx('Gunakan di DBSCAN Final', 'Use in Final DBSCAN')} <ArrowRight size={12} />
                            </button>
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
            title={tx('Belum ada hasil eksperimen', 'No experiment results yet')}
            message={tx('Hasil akan muncul setelah proses Pencarian Parameter selesai.', 'Results will appear after Parameter Search completes.')}
          />
        )}
      </GlassCard>

      <div className="admin-note">
        <FlaskConical size={16} />
        <span>
          {tx(
            'Penanda rekomendasi dan skor multikriteria merupakan hasil evaluasi berdasarkan kriteria validitas metodologis untuk membantu pengambilan keputusan penelitian DBSCAN Gempa Indonesia.',
            'Recommendation tags and multi-criteria scores reflect objective evaluation against methodological validity criteria for Indonesia Earthquake DBSCAN research.',
          )}
        </span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}
