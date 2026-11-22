import { useState } from 'react';
import { CheckCircle2, RefreshCw, Rocket } from 'lucide-react';
import { activateRun, getDatasets, getRunDetail, getRuns } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { usePipeline } from '../../context/PipelineContext';
import { useResource } from '../../hooks/useResource';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber, RecordDetails } from '../../components/ui';

export function RunHistoryPage() {
  const datasets = useResource(getDatasets, []);
  const { selectedDatasetId, setSelectedDatasetId } = usePipeline();
  const datasetId = selectedDatasetId ?? datasets.data?.[0]?.id ?? null;
  const runs = useResource(() => datasetId ? getRuns(datasetId) : Promise.resolve([]), [datasetId]);
  const [busyRun, setBusyRun] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const showDetail = async (runId: number) => {
    setDetailRunId(runId); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getRunDetail(runId)); }
    catch (reason) { setDetailError(reason instanceof Error ? reason.message : 'Rincian eksekusi tidak dapat dimuat.'); }
    finally { setDetailLoading(false); }
  };

  const activate = async (runId: number) => {
    if (IS_PREVIEW_MODE) return;
    if (!window.confirm(`Aktifkan hasil #${runId}? Hasil aktif akan menjadi sumber data yang ditampilkan pada WebGIS publik.`)) return;
    setBusyRun(runId); setMessage(null); setError(null);
    try { await activateRun(runId); setMessage(`Hasil #${runId} berhasil diaktifkan.`); runs.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Hasil gagal diaktifkan.'); }
    finally { setBusyRun(null); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / RIWAYAT EKSEKUSI" title="Riwayat Eksekusi" description="Tinjau hasil DBSCAN dan tentukan hasil yang akan ditampilkan pada WebGIS publik." action={<SimulationTag />} />
    <div className="run-filter glass-card"><label>Dataset<select value={datasetId ?? ''} onChange={(e) => setSelectedDatasetId(Number(e.target.value) || null)}><option value="">Pilih dataset</option>{datasets.data?.map((item) => <option key={item.id} value={item.id}>{item.dataset_name}</option>)}</select></label><button className="button button-secondary" onClick={runs.reload}><RefreshCw size={14} /> Muat ulang</button></div>
    {message && <div className="success-panel"><CheckCircle2 size={17} /><div><strong>Aktivasi berhasil</strong><span>{message}</span></div></div>}{error && <div className="form-error">{error}</div>}
    <GlassCard title="Daftar eksekusi" subtitle="Daftar eksekusi DBSCAN untuk dataset yang dipilih.">{runs.loading ? <StatePanel type="loading" title="Memuat riwayat" message="Mengambil daftar eksekusi." /> : runs.error ? <StatePanel type="error" title="Riwayat belum tersedia" message={runs.error} /> : !runs.data?.length ? <StatePanel type="empty" title="Belum ada eksekusi" message="Hasil yang dibuat melalui DBSCAN Final akan muncul di sini." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Eksekusi</th><th>Eksperimen</th><th>Epsilon (km)</th><th>MinPts</th><th>Klaster</th><th>Persentase Noise</th><th>Skor Silhouette</th><th>Status</th><th>Aktif</th><th /></tr></thead><tbody>{runs.data.map((run) => <tr key={run.id}><td><strong>#{run.id}</strong><small className="table-sub">{formatDate(run.created_at)}</small></td><td>#{run.selected_experiment_id}</td><td>{formatNumber(run.eps_km, 2)}</td><td>{run.min_samples}</td><td>{run.cluster_count === null ? '—' : formatNumber(run.cluster_count)}</td><td>{run.noise_percentage === null ? '—' : `${formatNumber(run.noise_percentage, 2)}%`}</td><td>{formatNumber(run.silhouette_score, 3)}</td><td><StatusBadge status={run.status} /></td><td>{run.is_active ? <span className="active-label"><i /> Aktif</span> : '—'}</td><td><div className="table-actions"><button className="text-button" onClick={() => void showDetail(run.id)}>Rincian</button>{run.status === 'SUCCESS' && !run.is_active && <button className="text-button" disabled={IS_PREVIEW_MODE || busyRun === run.id} onClick={() => void activate(run.id)}><Rocket size={13} />{busyRun === run.id ? 'Memproses…' : 'Aktifkan'}</button>}</div></td></tr>)}</tbody></table></div>}</GlassCard>
    {detailRunId !== null && <GlassCard title={`Rincian eksekusi #${detailRunId}`} subtitle="Informasi hasil eksekusi DBSCAN yang dipilih." action={<button className="icon-button" onClick={() => { setDetailRunId(null); setDetail(null); }} aria-label="Tutup detail">×</button>}>{detailLoading ? <StatePanel type="loading" title="Memuat rincian" message="Mengambil informasi eksekusi." /> : detailError ? <StatePanel type="error" title="Rincian tidak tersedia" message={detailError} /> : <RecordDetails record={detail || {}} />}</GlassCard>}
    <div className="admin-note"><Rocket size={16} /><span>Hasil yang diaktifkan akan digunakan oleh WebGIS publik. Penanda aktif berubah setelah sistem mengonfirmasi keberhasilan.</span></div>
  </div>;
}
