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

function ElbowTooltip({ active, payload, label }: { active?: boolean; payload?: ChartPayloadItem[]; label?: number | string }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((item) => typeof item.value === 'number');
  if (!visible.length) return null;
  return <div className="chart-tooltip elbow-chart-tooltip">
    <div className="chart-tooltip-heading"><span>JARAK TETANGGA</span><strong>Urutan titik {formatNumber(Number(label))}</strong></div>
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

function CurveStatus({ curve }: { curve: ElbowCurveSummary }) {
  return curve.knee_detected
    ? <span className="elbow-knee-status is-detected"><CheckCircle2 size={13} /> Titik Knee terdeteksi</span>
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
    setSummaryError(null);
    setSummaryLoading(true);
    getElbowSummary(jobId).then((result) => {
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
      title="Analisis K-Distance & Elbow"
      subtitle="Bandingkan kurva berdasarkan MinPts, periksa titik Knee, lalu cocokkan rekomendasi epsilon dengan eksperimen DBSCAN yang benar-benar diuji."
      action={jobId && jobStatus === 'SUCCESS' && !IS_PREVIEW_MODE ? <button className="button button-secondary elbow-refresh" type="button" onClick={retrySummary} disabled={summaryLoading}><RefreshCw size={13} /> Muat ulang</button> : undefined}
    >
      {IS_PREVIEW_MODE ? <StatePanel type="info" title="Analisis tersedia pada backend aktif" message="Mode Pratinjau tidak memuat artefak ilmiah simulasi. Hubungkan aplikasi ke backend untuk melihat hasil K-Distance yang sebenarnya." />
        : !jobId ? <StatePanel type="info" title="Belum ada proses Pencarian Parameter" message="Jalankan Pencarian Parameter atau buka proses yang sudah berhasil melalui Manajemen Proses. Analisis Elbow akan muncul pada proses yang dipilih." />
          : jobStatus === 'FAILED' || jobStatus === 'CANCELLED' ? <StatePanel type="error" title="Pencarian Parameter tidak berhasil diselesaikan" message="Analisis K-Distance tidak dapat dibuka karena proses sumber gagal atau dibatalkan. Periksa rincian proses pada Manajemen Proses." />
          : jobStatus !== 'SUCCESS' ? <StatePanel type="info" title="Menunggu Pencarian Parameter selesai" message="Kurva K-Distance dan titik Knee dapat ditinjau setelah backend menyelesaikan proses Pencarian Parameter." />
            : summaryLoading ? <StatePanel type="loading" title="Memuat analisis K-Distance" message="Mengambil ringkasan kurva dan metadata dari backend." />
              : summaryError ? <StatePanel type="info" title="Artefak analisis belum tersedia" message={summaryError} action={<button className="button button-secondary" type="button" onClick={retrySummary}>Coba lagi</button>} />
                : !summary ? <StatePanel type="empty" title="Analisis belum tersedia" message="Ringkasan kurva belum dapat ditampilkan." />
                  : !summary.ready ? <StatePanel type="info" title="Artefak belum siap ditampilkan" message="Backend belum menandai artefak K-Distance sebagai siap. Muat ulang setelah proses penyimpanan selesai." />
                    : !summary.curves.length ? <StatePanel type="empty" title="Kurva belum tersedia" message="Tidak ada kurva MinPts yang dikembalikan oleh backend untuk proses ini." />
                      : <div className="elbow-content">
                        <div className="elbow-context-strip">
                          <div><span>PROSES</span><strong>#{summary.job_id}</strong></div>
                          <div><span>DATASET</span><strong>{datasetName || `Dataset #${datasetId ?? summary.dataset_id}`}</strong></div>
                          <div><span>METRIK JARAK</span><strong>{summary.metric.toUpperCase()}</strong></div>
                          <div><span>UNIT JARAK</span><strong>{summary.distance_unit}</strong></div>
                        </div>

                        <div className="elbow-view-switch" role="tablist" aria-label="Tampilan analisis Elbow">
                          <button type="button" role="tab" aria-selected={view === 'comparison'} className={view === 'comparison' ? 'is-active' : ''} onClick={() => setView('comparison')}><Layers3 size={14} /> Perbandingan</button>
                          <button type="button" role="tab" aria-selected={view === 'detail'} className={view === 'detail' ? 'is-active' : ''} onClick={() => setView('detail')}><BarChart3 size={14} /> Detail Kurva</button>
                        </div>

                        {view === 'comparison' ? <div className="elbow-view-content">
                          <div className="elbow-section-heading"><div><h4>Perbandingan kurva MinPts</h4><p>Setiap garis menampilkan preview kurva yang dikirim backend. Pilih salah satu MinPts untuk membuka rincian.</p></div><span className="elbow-count">{formatNumber(summary.curves.length)} kurva</span></div>
                          {detailsLoading && !comparisonRows.length ? <StatePanel type="loading" title="Menyiapkan kurva perbandingan" message="Mengambil preview setiap kandidat MinPts secara bertahap." />
                            : comparisonRows.length ? <div className="elbow-chart-frame">
                              <div className="elbow-chart-wrap"><ResponsiveContainer width="100%" height="100%">
                                <LineChart data={comparisonRows} margin={{ top: 16, right: 18, left: 2, bottom: 26 }}>
                                  <CartesianGrid stroke="rgba(189,213,238,.09)" vertical={false} />
                                  <XAxis dataKey="rank" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value)} label={{ value: 'Urutan titik (rank)', position: 'insideBottom', offset: -16, fill: '#8198AD', fontSize: 10 }} />
                                  <YAxis tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value, 1)} width={54} label={{ value: 'Jarak (km)', angle: -90, position: 'insideLeft', fill: '#8198AD', fontSize: 10 }} />
                                  <Tooltip content={<ElbowTooltip />} cursor={{ stroke: 'rgba(72,215,237,.22)', strokeDasharray: '4 4' }} />
                                  <Legend verticalAlign="top" align="center" height={32} wrapperStyle={{ fontSize: 10, color: '#A9BBD0' }} />
                                  {summary.curves.map((curve, index) => <Line key={curve.min_samples} type="monotone" dataKey={curveKey(curve.min_samples)} name={`MinPts ${curve.min_samples}`} stroke={CURVE_COLORS[index % CURVE_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#EAF8FF', strokeWidth: 1 }} connectNulls={false} />)}
                                  {summary.curves.map((curve, index) => {
                                    const rank = kneeRank(details[curve.min_samples]?.record ?? null);
                                    if (!curve.knee_detected || rank === null || curve.epsilon_km === null) return null;
                                    return <ReferenceDot key={`knee-${curve.min_samples}`} x={rank} y={curve.epsilon_km} r={5} fill={CURVE_COLORS[index % CURVE_COLORS.length]} stroke="#F2FAFF" strokeWidth={1.5} />;
                                  })}
                                </LineChart>
                              </ResponsiveContainer></div>
                              <div className="elbow-legend-list">{summary.curves.map((curve, index) => <button key={curve.min_samples} type="button" className="elbow-legend-item" onClick={() => { setSelectedMinSamples(curve.min_samples); setView('detail'); }}><i style={{ background: CURVE_COLORS[index % CURVE_COLORS.length] }} /><span>MinPts {curve.min_samples}</span><strong>{curve.knee_detected && curve.epsilon_km !== null ? `${formatNumber(curve.epsilon_km, 2)} km` : 'Knee tidak terdeteksi'}</strong></button>)}</div>
                            </div> : <StatePanel type="empty" title="Preview kurva belum tersedia" message="Backend belum mengembalikan titik preview untuk kurva yang dipilih." />}

                          <div className="elbow-curve-grid">{summary.curves.map((curve, index) => <button key={curve.min_samples} type="button" className={`elbow-curve-card ${selectedMinSamples === curve.min_samples ? 'is-selected' : ''}`} onClick={() => { setSelectedMinSamples(curve.min_samples); setView('detail'); }}>
                            <div className="elbow-curve-card-top"><span className="elbow-curve-dot" style={{ background: CURVE_COLORS[index % CURVE_COLORS.length] }} /><strong>MinPts {curve.min_samples}</strong><span className="elbow-point-count">{formatNumber(curve.point_count)} titik</span></div>
                            <CurveStatus curve={curve} />
                            <div className="elbow-curve-epsilon"><span>Rekomendasi epsilon</span><strong>{curve.knee_detected && curve.epsilon_km !== null ? `${formatNumber(curve.epsilon_km, 3)} km` : '—'}</strong></div>
                          </button>)}</div>
                          <div className="elbow-download-row"><button className="button button-secondary" type="button" disabled={!summary.comparison_plot_url || downloadBusy === 'comparison'} onClick={() => void handleDownload(summary.comparison_plot_url, `seismap-job-${summary.job_id}-elbow-comparison.png`, 'comparison')}><ImageIcon size={14} />{downloadBusy === 'comparison' ? 'Mengunduh…' : 'Unduh grafik perbandingan (PNG)'}</button></div>
                        </div> : <div className="elbow-view-content">
                          <div className="elbow-detail-toolbar"><div className="elbow-minpts-picker"><label htmlFor="elbow-minpts-select">Pilih kandidat MinPts</label><select id="elbow-minpts-select" value={selectedMinSamples ?? ''} onChange={(event) => setSelectedMinSamples(Number(event.target.value))}>{summary.curves.map((curve) => <option key={curve.min_samples} value={curve.min_samples}>MinPts {curve.min_samples}</option>)}</select></div>
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
                              <div><span>Jumlah titik</span><strong>{formatNumber(selectedCurve.point_count)}</strong></div>
                              <div><span>Epsilon dari Knee</span><strong>{selectedCurve.knee_detected && selectedCurve.epsilon_km !== null ? `${formatNumber(selectedCurve.epsilon_km, 3)} km` : '—'}</strong></div>
                              <div><span>Status Knee</span><strong className={selectedCurve.knee_detected ? 'text-success' : 'text-warning'}>{selectedCurve.knee_detected ? 'Terdeteksi' : 'Tidak terdeteksi'}</strong></div>
                            </div>
                            <CurveStatus curve={selectedCurve} />
                            {detailsLoading && !details[selectedCurve.min_samples]?.record && !details[selectedCurve.min_samples]?.error ? <StatePanel type="loading" title="Memuat rincian kurva" message="Mengambil titik preview dan metadata dari backend." />
                              : details[selectedCurve.min_samples]?.error ? <StatePanel type="error" title="Rincian kurva gagal dimuat" message={details[selectedCurve.min_samples].error || 'Rincian kurva tidak tersedia.'} />
                                : selectedPoints.length ? <>
                                  <div className="elbow-section-heading"><div><h4>Kurva K-Distance — MinPts {selectedCurve.min_samples}</h4><p>Grafik menggunakan titik preview dari backend. Garis epsilon dan penanda Knee hanya ditampilkan jika tersedia pada hasil backend.</p></div></div>
                                  <div className="elbow-chart-frame"><div className="elbow-chart-wrap elbow-chart-detail"><ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={selectedPoints} margin={{ top: 16, right: 20, left: 4, bottom: 26 }}>
                                      <CartesianGrid stroke="rgba(189,213,238,.09)" vertical={false} />
                                      <XAxis dataKey="rank" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value)} label={{ value: 'Urutan titik (rank)', position: 'insideBottom', offset: -16, fill: '#8198AD', fontSize: 10 }} />
                                      <YAxis tick={{ fill: '#A9BBD0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => formatNumber(value, 1)} width={56} label={{ value: 'Jarak (km)', angle: -90, position: 'insideLeft', fill: '#8198AD', fontSize: 10 }} />
                                      <Tooltip content={<ElbowTooltip />} cursor={{ stroke: 'rgba(72,215,237,.22)', strokeDasharray: '4 4' }} />
                                      <Line type="monotone" dataKey="distance_km" name={`MinPts ${selectedCurve.min_samples}`} stroke="#48D7ED" strokeWidth={2.2} dot={false} activeDot={{ r: 4, stroke: '#EAF8FF', strokeWidth: 1 }} />
                                      {selectedCurve.knee_detected && selectedCurve.epsilon_km !== null && <ReferenceLine y={selectedCurve.epsilon_km} stroke="#F3B85F" strokeDasharray="6 5" label={{ value: `Epsilon ${formatNumber(selectedCurve.epsilon_km, 2)} km`, fill: '#F3C77F', fontSize: 10, position: 'insideTopRight' }} />}
                                      {selectedCurve.knee_detected && selectedCurve.epsilon_km !== null && selectedKneeRank !== null && <ReferenceDot x={selectedKneeRank} y={selectedCurve.epsilon_km} r={6} fill="#F3B85F" stroke="#FFF7E8" strokeWidth={2} />}
                                    </LineChart>
                                  </ResponsiveContainer></div></div>
                                  <div className="elbow-knee-explanation">{selectedCurve.knee_detected ? <><Target size={15} /><span>Titik Knee terdeteksi oleh backend. Nilai epsilon di atas merupakan kandidat awal untuk dibandingkan dengan hasil eksperimen DBSCAN, bukan keputusan parameter final.</span></> : <><Info size={15} /><span>Knee Point Not Detected. Sistem tidak membuat titik atau nilai epsilon pengganti. Gunakan kandidat epsilon eksplisit yang tercatat pada konfigurasi pencarian jika tersedia.</span></>}</div>
                                  {selectedConfig.length > 0 && <div className="elbow-config-card"><strong>Konfigurasi pembentukan kandidat</strong><div>{selectedConfig.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></div>}
                                </> : <StatePanel type="empty" title="Titik preview tidak tersedia" message="Backend belum mengembalikan titik kurva yang dapat divisualisasikan. Unduh PNG untuk memeriksa grafik tersimpan jika artefaknya tersedia." />}
                          </>}
                          {matchingExperiments.length > 0 && <div className="elbow-experiment-compare"><div className="elbow-section-heading"><div><h4>Eksperimen DBSCAN pada MinPts {selectedCurve?.min_samples}</h4><p>Bandingkan epsilon hasil Knee dengan epsilon yang benar-benar diuji pada eksperimen ini.</p></div><span className="elbow-count">{matchingExperiments.length} eksperimen</span></div>
                            <div className="table-scroll"><table className="data-table elbow-experiment-table"><thead><tr><th>ID Eksperimen</th><th>Epsilon diuji</th><th>Sumber epsilon</th><th>Pembulatan</th><th>Versi metode</th><th>Validitas</th><th>Klaster</th><th>Noise</th><th>Silhouette</th></tr></thead><tbody>{matchingExperiments.map((experiment) => { const provenance = resolveExperimentProvenance(experiment, jobMetadata); return <tr key={experiment.id}><td>#{experiment.id}</td><td>{formatNumber(experiment.eps_km, 3)} km</td><td>{provenance.epsSources?.length ? provenance.epsSources.join(', ') : '—'}</td><td>{provenance.roundingKm !== null ? `${formatNumber(provenance.roundingKm, 1)} km` : '—'}</td><td>{provenance.methodVersion ?? '—'}</td><td><StatusBadge status={experiment.is_valid ? 'VALID' : 'INVALID'} /></td><td>{formatNumber(experiment.cluster_count)}</td><td>{formatNumber(experiment.noise_percentage, 2)}%</td><td>{formatNumber(experiment.silhouette_score, 3)}</td></tr>; })}</tbody></table></div>
                          </div>}
                          {experiments && !matchingExperiments.length && <div className="elbow-no-experiment"><Info size={14} />Belum ada eksperimen DBSCAN yang menggunakan MinPts {selectedCurve?.min_samples}.</div>}
                          {!experiments && <div className="elbow-no-experiment"><Info size={14} />Hasil eksperimen sedang dimuat atau belum tersedia.</div>}
                        </div>}
                        <div className="elbow-method-note"><Activity size={15} /><span>Perhitungan KNN, deteksi Knee, dan rekomendasi epsilon sepenuhnya dilakukan backend dengan koordinat latitude–longitude dan metrik Haversine. Magnitudo, kedalaman, waktu, serta lokasi tetap digunakan untuk profiling pascaklasterisasi.</span></div>
                      </div>}
      {downloadError && view === 'comparison' && <div className="elbow-download-error"><AlertCircle size={14} />{downloadError}</div>}
    </GlassCard>
  </section>;
}
