import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, BarChart3, CheckCircle2, FileJson,
  FileSpreadsheet, Image as ImageIcon, Info, Layers3, RefreshCw, Target,
} from 'lucide-react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fetchElbowArtifact, getElbowDetail, getElbowSummary } from '../api/services';
import type { ElbowCurveSummary, ElbowDetailRecord, ElbowSummary } from '../api/services';
import type { ParameterExperiment, ParameterSearchMetadata } from '../types/domain';
import { resolveExperimentProvenance } from '../utils/parameterSearchMetadata';
import { IS_PREVIEW_MODE } from '../config/env';
import { useI18n } from '../i18n/LanguageContext';
import type { Language } from '../i18n/types';
import { invalidateCachePrefix } from '../utils/resourceCache';
import { GlassCard, StatePanel, StatusBadge, formatNumber } from './ui';
import { ApiError } from '../types/api';

type ViewMode = 'comparison' | 'detail';
type CurvePoint = { rank: number; distance_km: number };
type DetailState = { record: ElbowDetailRecord | null; error: string | null };
type ChartPayloadItem = { color?: string; name?: string; value?: number | string; dataKey?: string | number };

const CURVE_COLORS = ['#48D7ED', '#9583FF', '#48C9A7', '#F3B85F', '#F78DA7', '#78A9FF', '#B5D86B', '#D99CFF'];
const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readFirstNumber(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asFiniteNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function detailMetadata(detail: ElbowDetailRecord | null): Record<string, unknown> | null {
  if (!detail) return null;
  return asRecord(detail.metadata) ?? detail;
}

function previewPoints(detail: ElbowDetailRecord | null): CurvePoint[] {
  if (!detail) return [];
  const metadata = detailMetadata(detail);
  const raw = Array.isArray(detail.preview_points)
    ? detail.preview_points
    : Array.isArray(metadata?.preview_points) ? metadata.preview_points : [];

  return raw.flatMap((item): CurvePoint[] => {
    if (Array.isArray(item) && item.length >= 2) {
      const rank = asFiniteNumber(item[0]);
      const distance = asFiniteNumber(item[1]);
      return rank !== null && distance !== null ? [{ rank, distance_km: distance }] : [];
    }
    const point = asRecord(item);
    if (!point) return [];
    const rank = readFirstNumber(point, ['rank', 'k', 'neighbor_rank']);
    const distance = readFirstNumber(point, ['distance_km', 'k_distance_km', 'distance']);
    return rank !== null && distance !== null ? [{ rank, distance_km: distance }] : [];
  });
}

function kneeRank(detail: ElbowDetailRecord | null): number | null {
  const metadata = detailMetadata(detail);
  const knee = asRecord(metadata?.knee);
  const kneePoint = asRecord(metadata?.knee_point);
  return readFirstNumber(metadata, ['knee_rank', 'knee_point_rank'])
    ?? readFirstNumber(knee, ['rank'])
    ?? readFirstNumber(kneePoint, ['rank']);
}

function configurationEntries(detail: ElbowDetailRecord | null): Array<{ label: string; value: string }> {
  const metadata = detailMetadata(detail);
  const configuration = asRecord(detail?.search_configuration) ?? asRecord(metadata?.search_configuration);
  if (!configuration) return [];
  const fields: Array<{ keys: string[]; label: string }> = [
    { keys: ['min_samples_candidates'], label: 'Kandidat MinPts' },
    { keys: ['sensitivity_percentages'], label: 'Persentase sensitivitas' },
    { keys: ['eps_candidates_km'], label: 'Kandidat Epsilon eksplisit' },
  ];
  return fields.flatMap(({ keys, label }) => {
    const key = keys.find((candidate) => configuration[candidate] !== undefined && configuration[candidate] !== null);
    if (!key) return [];
    const raw = configuration[key];
    const value = Array.isArray(raw)
      ? raw.map((entry) => typeof entry === 'number' ? numberFormatter.format(entry) : String(entry)).join(', ')
      : typeof raw === 'number' ? numberFormatter.format(raw) : String(raw);
    return [{ label, value }];
  });
}

function curveKey(minSamples: number): string {
  return `minpts_${minSamples}`;
}

function buildComparisonRows(curves: ElbowCurveSummary[], details: Record<number, DetailState>): Array<Record<string, number>> {
  const rows = new Map<number, Record<string, number>>();
  curves.forEach((curve) => {
    const state = details[curve.min_samples];
    previewPoints(state?.record ?? null).forEach((point) => {
      const row = rows.get(point.rank) ?? { rank: point.rank };
      row[curveKey(curve.min_samples)] = point.distance_km;
      rows.set(point.rank, row);
    });
  });
  return [...rows.values()].sort((a, b) => a.rank - b.rank);
}

function ElbowTooltip({ active, payload, label, lang }: { active?: boolean; payload?: ChartPayloadItem[]; label?: number | string; lang: Language }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((item) => typeof item.value === 'number');
  if (!visible.length) return null;
  return <div className="chart-tooltip elbow-chart-tooltip">
    <div className="chart-tooltip-heading"><span>{lang === 'en' ? 'NEIGHBOR DISTANCE' : 'JARAK TETANGGA'}</span><strong>{lang === 'en' ? 'Point rank' : 'Urutan titik'} {formatNumber(Number(label))}</strong></div>
    <div className="chart-tooltip-rows">
      {visible.map((item) => <div className="chart-tooltip-row" key={String(item.dataKey)}>
        <span className="chart-tooltip-label"><i style={{ backgroundColor: item.color || '#48D7ED' }} />{item.name || String(item.dataKey)}</span>
        <strong>{formatNumber(Number(item.value), 3)}<small> km</small></strong>
      </div>)}
    </div>
  </div>;
}

function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function downloadName(jobId: number, minSamples: number, extension: string): string {
  return `seismap-job-${jobId}-minpts-${minSamples}-k-distance.${extension}`;
}

function CurveStatus({ curve, lang }: { curve: ElbowCurveSummary; lang: Language }) {
  return curve.knee_detected
    ? <span className="elbow-knee-status is-detected"><CheckCircle2 size={13} /> {lang === 'en' ? 'Knee point detected' : 'Titik Knee terdeteksi'}</span>
    : <span className="elbow-knee-status is-missing"><AlertCircle size={13} /> Knee Point Not Detected</span>;
}

export function ElbowAnalysisPanel({
  jobId,
  datasetId,
  datasetName,
  jobStatus,
  experiments,
  jobMetadata,
}: {
  jobId: number | null;
  datasetId: number | null;
  datasetName?: string;
  jobStatus?: string;
  experiments: ParameterExperiment[] | null;
  jobMetadata?: ParameterSearchMetadata | null;
}) {
  const { lang, tx } = useI18n();
  const [summary, setSummary] = useState<ElbowSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<number, DetailState>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedMinSamples, setSelectedMinSamples] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>('comparison');
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSummary(null);
    setDetails({});
    setSelectedMinSamples(null);
    setSummaryError(null);
    setDownloadError(null);

    if (!jobId || jobStatus !== 'SUCCESS' || IS_PREVIEW_MODE) {
      setSummaryLoading(false);
      return () => { active = false; };
    }

    setSummaryLoading(true);
    getElbowSummary(jobId).then((result) => {
      if (!active) return;
      setSummary(result);
      setSelectedMinSamples(result.curves[0]?.min_samples ?? null);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && (reason.status === 404 || reason.code === 'NOT_FOUND')) {
        setSummaryError('Artefak analisis belum tersedia untuk proses ini. Job lama yang dibuat sebelum fitur Elbow tersedia memang tidak memiliki grafik tersimpan.');
      } else {
        setSummaryError(reason instanceof Error ? reason.message : 'Ringkasan analisis K-Distance gagal dimuat.');
      }
    }).finally(() => { if (active) setSummaryLoading(false); });

    return () => { active = false; };
  }, [jobId, jobStatus]);

  useEffect(() => {
    let active = true;
    if (!summary?.ready || !summary.curves.length) {
      setDetails({});
      setDetailsLoading(false);
      return () => { active = false; };
    }

    setDetailsLoading(true);
    // Batasi request detail bersamaan agar banyak kandidat MinPts tidak
    // membanjiri browser maupun API. Hasil masuk bertahap ke tampilan.
    const queue = summary.curves;
    let nextIndex = 0;
    const worker = async () => {
      while (active) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= queue.length) return;
        const curve = queue[index];
        let state: DetailState;
        if (!curve.detail_url) {
          state = { record: null, error: 'Tautan rincian kurva tidak disediakan server.' };
        } else {
          try {
            const record = await getElbowDetail(curve.detail_url);
            state = { record, error: null };
          } catch (reason) {
            state = { record: null, error: reason instanceof Error ? reason.message : 'Rincian kurva gagal dimuat.' };
          }
        }
        if (active) {
          setDetails((current) => ({ ...current, [curve.min_samples]: state }));
        }
      }
    };

    const workerCount = Math.min(3, queue.length);
    void Promise.all(Array.from({ length: workerCount }, () => worker()))
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [summary]);

  const selectedCurve = summary?.curves.find((curve) => curve.min_samples === selectedMinSamples) ?? null;
  const selectedDetail = selectedCurve ? details[selectedCurve.min_samples]?.record ?? null : null;
  const selectedPoints = useMemo(() => previewPoints(selectedDetail), [selectedDetail]);
  const selectedKneeRank = kneeRank(selectedDetail);
  const comparisonRows = useMemo(() => summary ? buildComparisonRows(summary.curves, details) : [], [summary, details]);
  const selectedConfig = useMemo(() => configurationEntries(selectedDetail), [selectedDetail]);
  const matchingExperiments = useMemo(() => selectedCurve
    ? (experiments || []).filter((experiment) => experiment.min_samples === selectedCurve.min_samples)
    : [], [experiments, selectedCurve]);

  const handleDownload = async (url: string | null | undefined, filename: string, key: string) => {
    if (!url) return;
    setDownloadBusy(key);
    setDownloadError(null);
    try {
      const blob = await fetchElbowArtifact(url);
      saveBlob(blob, filename);
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : 'Unduhan artefak gagal.');
    } finally {
      setDownloadBusy(null);
    }
  };

  const retrySummary = () => {
    if (!jobId) return;
    invalidateCachePrefix('admin', `elbow:summary:${jobId}`);
    summary?.curves.forEach((curve) => {
      if (curve.detail_url) {
        try {
          const parsed = new URL(curve.detail_url, window.location.origin);
          invalidateCachePrefix('admin', `elbow:detail:${parsed.pathname}${parsed.search}`);
        } catch {
          invalidateCachePrefix('admin', `elbow:detail:${curve.detail_url}`);
        }
      }
    });
    setSummaryError(null);
    setSummaryLoading(true);
    getElbowSummary(jobId, { forceRefresh: true }).then((result) => {
      setSummary(result);
      setSelectedMinSamples(result.curves[0]?.min_samples ?? null);
    }).catch((reason: unknown) => {
      if (reason instanceof ApiError && (reason.status === 404 || reason.code === 'NOT_FOUND')) {
        setSummaryError('Artefak analisis belum tersedia untuk proses ini.');
      } else setSummaryError(reason instanceof Error ? reason.message : 'Ringkasan analisis gagal dimuat.');
    }).finally(() => setSummaryLoading(false));
  };

  return <section className="elbow-section" id="elbow-analysis">
    <GlassCard
      title={tx('Analisis Kurva k-Distance', 'k-Distance Curve Analysis')}
      subtitle={tx('Bandingkan kurva k-distance tiap MinPts untuk melihat titik siku (knee) dan kandidat epsilon.', 'Compare k-distance curves per MinPts to examine knee points and candidate epsilon values.')}
      action={jobId && jobStatus === 'SUCCESS' && !IS_PREVIEW_MODE ? <button className="button button-secondary elbow-refresh" type="button" onClick={retrySummary} disabled={summaryLoading}><RefreshCw size={13} /> {tx('Muat ulang', 'Reload')}</button> : undefined}
    >
      {IS_PREVIEW_MODE ? <StatePanel type="info" title={tx('Analisis tersedia pada backend aktif', 'Analysis available on live API')} message={tx('Mode Pratinjau tidak memuat artefak ilmiah simulasi. Hubungkan aplikasi ke backend untuk melihat hasil K-Distance yang sebenarnya.', 'Preview Mode does not load simulated curve artifacts. Connect to a live backend to inspect actual k-Distance results.')} />
        : !jobId ? <StatePanel type="info" title={tx('Belum ada proses Pencarian Parameter', 'No Parameter Search job selected')} message={tx('Jalankan Pencarian Parameter atau buka proses yang sudah berhasil melalui Manajemen Proses. Analisis Elbow akan muncul pada proses yang dipilih.', 'Run a Parameter Search or open a completed job from Job Management. Elbow analysis will appear for the selected job.')} />
          : jobStatus === 'FAILED' || jobStatus === 'CANCELLED' ? <StatePanel type="error" title={tx('Pencarian Parameter tidak berhasil diselesaikan', 'Parameter Search did not complete')} message={tx('Analisis K-Distance tidak dapat dibuka karena proses sumber gagal atau dibatalkan. Periksa rincian proses pada Manajemen Proses.', 'k-Distance analysis cannot be opened because the source job failed or was cancelled. Check details in Job Management.')} />
          : jobStatus !== 'SUCCESS' ? <StatePanel type="info" title={tx('Menunggu Pencarian Parameter selesai', 'Waiting for Parameter Search to finish')} message={tx('Kurva K-Distance dan titik Knee dapat ditinjau setelah backend menyelesaikan proses Pencarian Parameter.', 'k-Distance curves and knee points can be reviewed once Parameter Search finishes.')} />
            : summaryLoading ? <StatePanel type="loading" title={tx('Memuat analisis K-Distance', 'Loading k-Distance analysis')} message={tx('Mengambil ringkasan kurva dan metadata dari server.', 'Fetching curve summaries and metadata from the server.')} />
              : summaryError ? <StatePanel type="info" title={tx('Artefak analisis belum tersedia', 'Analysis artifacts unavailable')} message={summaryError} action={<button className="button button-secondary" type="button" onClick={retrySummary}>{tx('Coba lagi', 'Try again')}</button>} />
                : !summary ? <StatePanel type="empty" title={tx('Analisis belum tersedia', 'Analysis unavailable')} message={tx('Ringkasan kurva belum dapat ditampilkan.', 'Curve summary could not be displayed.')} />
                  : !summary.ready ? <StatePanel type="info" title={tx('Artefak belum siap ditampilkan', 'Artifacts not ready yet')} message={tx('Backend belum menandai artefak K-Distance sebagai siap. Muat ulang setelah proses penyimpanan selesai.', 'Artifacts are not marked ready yet. Reload after artifact persistence finishes.')} />
                    : !summary.curves.length ? <StatePanel type="empty" title={tx('Kurva belum tersedia', 'No curves available')} message={tx('Tidak ada kurva MinPts yang dikembalikan untuk proses ini.', 'No MinPts curves were returned for this job.')} />
                      : <div className="elbow-content">
                        <div className="elbow-context-strip">
                          <div><span>{tx('PROSES', 'JOB')}</span><strong>#{summary.job_id}</strong></div>
                          <div><span>DATASET</span><strong>{datasetName || `Dataset #${datasetId ?? summary.dataset_id}`}</strong></div>
                          <div><span>{tx('METRIK JARAK', 'DISTANCE METRIC')}</span><strong>{summary.metric.toUpperCase()}</strong></div>
                          <div><span>{tx('UNIT JARAK', 'DISTANCE UNIT')}</span><strong>{summary.distance_unit}</strong></div>
                        </div>

                        <div className="elbow-view-switch" role="tablist" aria-label={tx('Tampilan analisis Elbow', 'Elbow analysis view')}>
                          <button type="button" role="tab" aria-selected={view === 'comparison'} className={view === 'comparison' ? 'is-active' : ''} onClick={() => setView('comparison')}><Layers3 size={14} /> {tx('Perbandingan', 'Comparison')}</button>
                          <button type="button" role="tab" aria-selected={view === 'detail'} className={view === 'detail' ? 'is-active' : ''} onClick={() => setView('detail')}><BarChart3 size={14} /> {tx('Detail Kurva', 'Curve Details')}</button>
                        </div>

                        {view === 'comparison' ? <div className="elbow-view-content">
                          <div className="elbow-section-heading"><div><h4>{tx('Perbandingan kurva MinPts', 'MinPts curve comparison')}</h4><p>{tx('Setiap garis menampilkan preview kurva dari server. Pilih salah satu MinPts untuk membuka rincian.', 'Each line represents a preview k-distance curve. Select a MinPts candidate to inspect details.')}</p></div><span className="elbow-count">{formatNumber(summary.curves.length)} {tx('kurva', 'curves')}</span></div>
                          {detailsLoading && !comparisonRows.length ? <StatePanel type="loading" title={tx('Menyiapkan kurva perbandingan', 'Preparing comparison curves')} message={tx('Mengambil preview setiap kandidat MinPts secara bertahap.', 'Loading curve previews incrementally per MinPts candidate.')} />
                            : comparisonRows.length ? <div className="elbow-chart-frame">
                              <div className="elbow-chart-wrap"><ResponsiveContainer width="100%" height="100%">
                                <LineChart data={comparisonRows} margin={{ top: 16, right: 18, left: 2, bottom: 26 }}>
                                  <CartesianGrid stroke="rgba(189,213,238,.09)" vertical={false} />
                                  <XAxis dataKey="rank" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value)} label={{ value: tx('Urutan titik (rank)', 'Point rank'), position: 'insideBottom', offset: -16, fill: '#8198AD', fontSize: 10 }} />
                                  <YAxis tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value, 1)} width={54} label={{ value: tx('Jarak (km)', 'Distance (km)'), angle: -90, position: 'insideLeft', fill: '#8198AD', fontSize: 10 }} />
                                  <Tooltip content={<ElbowTooltip lang={lang} />} cursor={{ stroke: 'rgba(72,215,237,.22)', strokeDasharray: '4 4' }} />
                                  <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ fontSize: 10, color: '#A9BBD0' }} />
                                  {summary.curves.map((curve, index) => <Line key={curve.min_samples} type="monotone" dataKey={curveKey(curve.min_samples)} name={`MinPts ${curve.min_samples}`} stroke={CURVE_COLORS[index % CURVE_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#EAF8FF', strokeWidth: 1 }} connectNulls={false} />)}
                                  {summary.curves.map((curve, index) => {
                                    const rank = kneeRank(details[curve.min_samples]?.record ?? null);
                                    if (!curve.knee_detected || rank === null || curve.epsilon_km === null) return null;
                                    return <ReferenceDot key={`knee-${curve.min_samples}`} x={rank} y={curve.epsilon_km} r={5} fill={CURVE_COLORS[index % CURVE_COLORS.length]} stroke="#F2FAFF" strokeWidth={1.5} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer></div>
                              <div className="elbow-legend-list">{summary.curves.map((curve, index) => <button key={curve.min_samples} type="button" className="elbow-legend-item" onClick={() => { setSelectedMinSamples(curve.min_samples); setView('detail'); }}><i style={{ background: CURVE_COLORS[index % CURVE_COLORS.length] }} /><span>MinPts {curve.min_samples}</span><strong>{curve.knee_detected && curve.epsilon_km !== null ? `${formatNumber(curve.epsilon_km, 2)} km` : tx('Knee tidak terdeteksi', 'Knee not detected')}</strong></button>)}</div>
                            </div> : <StatePanel type="empty" title={tx('Preview kurva belum tersedia', 'Curve preview unavailable')} message={tx('Server belum mengembalikan titik preview untuk kurva yang dipilih.', 'Preview points are not available for the selected curve.')} />}

                          <div className="elbow-curve-grid">{summary.curves.map((curve, index) => <button key={curve.min_samples} type="button" className={`elbow-curve-card ${selectedMinSamples === curve.min_samples ? 'is-selected' : ''}`} onClick={() => { setSelectedMinSamples(curve.min_samples); setView('detail'); }}>
                            <div className="elbow-curve-card-top"><span className="elbow-curve-dot" style={{ background: CURVE_COLORS[index % CURVE_COLORS.length] }} /><strong>MinPts {curve.min_samples}</strong><span className="elbow-point-count">{formatNumber(curve.point_count)} {tx('titik', 'points')}</span></div>
                            <CurveStatus curve={curve} lang={lang} />
                            <div className="elbow-curve-epsilon"><span>{tx('Rekomendasi epsilon', 'Epsilon candidate')}</span><strong>{curve.knee_detected && curve.epsilon_km !== null ? `${formatNumber(curve.epsilon_km, 3)} km` : '—'}</strong></div>
                          </button>)}</div>
                          <div className="elbow-download-row"><button className="button button-secondary" type="button" disabled={!summary.comparison_plot_url || downloadBusy === 'comparison'} onClick={() => void handleDownload(summary.comparison_plot_url, `seismap-job-${summary.job_id}-elbow-comparison.png`, 'comparison')}><ImageIcon size={14} />{downloadBusy === 'comparison' ? tx('Mengunduh…', 'Downloading…') : tx('Unduh grafik perbandingan (PNG)', 'Download comparison plot (PNG)')}</button></div>
                        </div> : <div className="elbow-view-content">
                          <div className="elbow-detail-toolbar"><div className="elbow-minpts-picker"><label htmlFor="elbow-minpts-select">{tx('Pilih kandidat MinPts', 'Select MinPts candidate')}</label><select id="elbow-minpts-select" value={selectedMinSamples ?? ''} onChange={(event) => setSelectedMinSamples(Number(event.target.value))}>{summary.curves.map((curve) => <option key={curve.min_samples} value={curve.min_samples}>MinPts {curve.min_samples}</option>)}</select></div>
                            {selectedCurve && <div className="elbow-download-actions">
                              <button className="button button-secondary" type="button" disabled={!selectedCurve.plot_url || downloadBusy === 'plot'} onClick={() => void handleDownload(selectedCurve.plot_url, downloadName(summary.job_id, selectedCurve.min_samples, 'png'), 'plot')}><ImageIcon size={13} /> PNG</button>
                              <button className="button button-secondary" type="button" disabled={!selectedCurve.data_url || downloadBusy === 'data'} onClick={() => void handleDownload(selectedCurve.data_url, downloadName(summary.job_id, selectedCurve.min_samples, 'csv'), 'data')}><FileSpreadsheet size={13} /> CSV</button>
                              <button className="button button-secondary" type="button" disabled={!selectedCurve.metadata_url || downloadBusy === 'metadata'} onClick={() => void handleDownload(selectedCurve.metadata_url, downloadName(summary.job_id, selectedCurve.min_samples, 'json'), 'metadata')}><FileJson size={13} /> JSON</button>
                            </div>}
                          </div>
                          {downloadError && <div className="elbow-download-error"><AlertCircle size={14} />{downloadError}</div>}
                          {selectedCurve && <>
                            <div className="elbow-detail-summary">
                              <div><span>MinPts</span><strong>{selectedCurve.min_samples}</strong></div>
                              <div><span>{tx('Jumlah titik', 'Point count')}</span><strong>{formatNumber(selectedCurve.point_count)}</strong></div>
                              <div><span>{tx('Epsilon dari Knee', 'Knee Epsilon')}</span><strong>{selectedCurve.knee_detected && selectedCurve.epsilon_km !== null ? `${formatNumber(selectedCurve.epsilon_km, 3)} km` : '—'}</strong></div>
                              <div><span>{tx('Status Knee', 'Knee Status')}</span><strong className={selectedCurve.knee_detected ? 'text-success' : 'text-warning'}>{selectedCurve.knee_detected ? tx('Terdeteksi', 'Detected') : tx('Tidak terdeteksi', 'Not detected')}</strong></div>
                            </div>
                            <CurveStatus curve={selectedCurve} lang={lang} />
                            {detailsLoading && !details[selectedCurve.min_samples]?.record && !details[selectedCurve.min_samples]?.error ? <StatePanel type="loading" title={tx('Memuat rincian kurva', 'Loading curve details')} message={tx('Mengambil titik preview dan metadata dari server.', 'Fetching preview points and metadata from the server.')} />
                              : details[selectedCurve.min_samples]?.error ? <StatePanel type="error" title={tx('Rincian kurva gagal dimuat', 'Failed to load curve details')} message={details[selectedCurve.min_samples].error || tx('Rincian kurva tidak tersedia.', 'Curve details unavailable.')} />
                                : selectedPoints.length ? <>
                                  <div className="elbow-section-heading"><div><h4>{tx('Kurva K-Distance', 'k-Distance Curve')} — MinPts {selectedCurve.min_samples}</h4><p>{tx('Grafik menggunakan titik preview dari server. Garis epsilon dan penanda Knee hanya ditampilkan jika tersedia pada hasil.', 'Chart uses server preview points. Epsilon threshold and Knee markers appear only when detected.')}</p></div></div>
                                  <div className="elbow-chart-frame"><div className="elbow-chart-wrap elbow-chart-detail"><ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={selectedPoints} margin={{ top: 16, right: 20, left: 4, bottom: 26 }}>
                                      <CartesianGrid stroke="rgba(189,213,238,.09)" vertical={false} />
                                      <XAxis dataKey="rank" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value)} label={{ value: tx('Urutan titik (rank)', 'Point rank'), position: 'insideBottom', offset: -16, fill: '#8198AD', fontSize: 10 }} />
                                      <YAxis tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value, 1)} width={56} label={{ value: tx('Jarak (km)', 'Distance (km)'), angle: -90, position: 'insideLeft', fill: '#8198AD', fontSize: 10 }} />
                                      <Tooltip content={<ElbowTooltip lang={lang} />} cursor={{ stroke: 'rgba(72,215,237,.22)', strokeDasharray: '4 4' }} />
                                      <Line type="monotone" dataKey="distance_km" name={`MinPts ${selectedCurve.min_samples}`} stroke="#48D7ED" strokeWidth={2.2} dot={false} activeDot={{ r: 4, stroke: '#EAF8FF', strokeWidth: 1 }} />
                                      {selectedCurve.knee_detected && selectedCurve.epsilon_km !== null && <ReferenceLine y={selectedCurve.epsilon_km} stroke="#F3B85F" strokeDasharray="6 5" label={{ value: `Epsilon ${formatNumber(selectedCurve.epsilon_km, 2)} km`, fill: '#F3C77F', fontSize: 10, position: 'insideTopRight' }} />}
                                      {selectedCurve.knee_detected && selectedCurve.epsilon_km !== null && selectedKneeRank !== null && <ReferenceDot x={selectedKneeRank} y={selectedCurve.epsilon_km} r={6} fill="#F3B85F" stroke="#FFF7E8" strokeWidth={2} />}
                                    </LineChart>
                                  </ResponsiveContainer></div></div>
                                  <div className="elbow-knee-explanation">{selectedCurve.knee_detected ? <><Target size={15} /><span>{tx('Titik Knee terdeteksi pada kurva ini. Nilai epsilon tersebut menjadi kandidat awal untuk dibandingkan dengan hasil eksperimen DBSCAN.', 'A Knee point was detected on this curve. The epsilon value serves as a candidate alongside evaluated DBSCAN experiments.')}</span></> : <><Info size={15} /><span>{tx('Knee Point Not Detected. Sistem tidak membuat titik pengganti; gunakan kandidat epsilon eksplisit yang tercatat pada konfigurasi pencarian.', 'Knee Point Not Detected. No synthetic fallback point is generated; rely on explicit epsilon candidates from search config.')}</span></>}</div>
                                  {selectedConfig.length > 0 && <div className="elbow-config-card"><strong>{tx('Konfigurasi pembentukan kandidat', 'Candidate generation config')}</strong><div>{selectedConfig.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>}
                                </> : <StatePanel type="empty" title={tx('Titik preview tidak tersedia', 'Preview points unavailable')} message={tx('Server belum mengembalikan titik kurva untuk divisualisasikan. Unduh PNG jika tersedia.', 'Preview points are unavailable for plotting. Download the PNG plot if available.')} />}
                          </>}
                          {matchingExperiments.length > 0 && <div className="elbow-experiment-compare"><div className="elbow-section-heading"><div><h4>{tx('Eksperimen DBSCAN pada MinPts', 'DBSCAN Experiments at MinPts')} {selectedCurve?.min_samples}</h4><p>{tx('Bandingkan epsilon hasil Knee dengan epsilon yang benar-benar diuji pada eksperimen ini.', 'Compare Knee epsilon against the actual epsilon values tested in DBSCAN experiments.')}</p></div><span className="elbow-count">{matchingExperiments.length} {tx('eksperimen', 'experiments')}</span></div>
                            <div className="table-scroll"><table className="data-table elbow-experiment-table"><thead><tr><th>{tx('ID Eksperimen', 'Experiment ID')}</th><th>{tx('Epsilon diuji', 'Tested Epsilon')}</th><th>{tx('Sumber epsilon', 'Epsilon Source')}</th><th>{tx('Pembulatan', 'Rounding')}</th><th>{tx('Versi metode', 'Method Ver.')}</th><th>{tx('Validitas', 'Validity')}</th><th>{tx('Klaster', 'Clusters')}</th><th>Noise</th><th>Silhouette</th></tr></thead><tbody>{matchingExperiments.map((experiment) => { const provenance = resolveExperimentProvenance(experiment, jobMetadata); return <tr key={experiment.id}><td>#{experiment.id}</td><td>{formatNumber(experiment.eps_km, 3)} km</td><td>{provenance.epsSources?.length ? provenance.epsSources.join(', ') : '—'}</td><td>{provenance.roundingKm !== null ? `${formatNumber(provenance.roundingKm, 1)} km` : '—'}</td><td>{provenance.methodVersion ?? '—'}</td><td><StatusBadge status={experiment.is_valid ? 'VALID' : 'INVALID'} /></td><td>{formatNumber(experiment.cluster_count)}</td><td>{formatNumber(experiment.noise_percentage, 2)}%</td><td>{formatNumber(experiment.silhouette_score, 3)}</td></tr>; })}</tbody></table></div>
                          </div>}
                          {experiments && !matchingExperiments.length && <div className="elbow-no-experiment"><Info size={14} />{tx('Belum ada eksperimen DBSCAN yang menggunakan MinPts', 'No DBSCAN experiments found using MinPts')} {selectedCurve?.min_samples}.</div>}
                          {!experiments && <div className="elbow-no-experiment"><Info size={14} />{tx('Hasil eksperimen sedang dimuat atau belum tersedia.', 'Experiment results are loading or unavailable.')}</div>}
                        </div>}
                        <div className="elbow-method-note"><Activity size={15} /><span>{tx('Perhitungan KNN, deteksi Knee, dan rekomendasi epsilon sepenuhnya dilakukan dengan koordinat latitude–longitude dan metrik Haversine. Magnitudo, kedalaman, waktu, serta lokasi tetap digunakan untuk profiling pascaklasterisasi.', 'KNN distance calculation, Knee detection, and epsilon recommendations operate strictly on latitude–longitude with the Haversine metric. Magnitude, depth, time, and location are used for post-clustering profiling.')}</span></div>
                      </div>}
      {downloadError && view === 'comparison' && <div className="elbow-download-error"><AlertCircle size={14} />{downloadError}</div>}
    </GlassCard>
  </section>;
}
