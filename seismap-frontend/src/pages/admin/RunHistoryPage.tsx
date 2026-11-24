import { useState } from 'react';
import { CheckCircle2, RefreshCw, Rocket } from 'lucide-react';
import { activateRun, getDatasets, getRunDetail, getRuns } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { usePipeline } from '../../context/PipelineContext';
import { useResource } from '../../hooks/useResource';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import type { DBSCANRun } from '../../types/domain';

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
  const [confirmingRun, setConfirmingRun] = useState<DBSCANRun | null>(null);

  const showDetail = async (runId: number) => {
    setDetailRunId(runId); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getRunDetail(runId)); }
    catch (reason) { setDetailError(reason instanceof Error ? reason.message : 'Rincian eksekusi tidak dapat dimuat.'); }
    finally { setDetailLoading(false); }
  };

  const handleConfirmActivate = async () => {
    if (!confirmingRun || IS_PREVIEW_MODE) return;
    const runId = confirmingRun.id;
    setBusyRun(runId);
    setMessage(null);
    setError(null);
    try {
      await activateRun(runId);
      setMessage(`Hasil #${runId} berhasil diaktifkan sebagai rujukan WebGIS publik.`);
      runs.reload();
      setConfirmingRun(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hasil gagal diaktifkan.');
    } finally {
      setBusyRun(null);
    }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / RIWAYAT EKSEKUSI" title="Riwayat Eksekusi" description="Tinjau hasil DBSCAN dan tentukan hasil yang akan ditampilkan pada WebGIS publik." action={<SimulationTag />} />
    <div className="run-filter glass-card"><label>Dataset<select value={datasetId ?? ''} onChange={(e) => setSelectedDatasetId(Number(e.target.value) || null)}><option value="">Pilih dataset</option>{datasets.data?.map((item) => <option key={item.id} value={item.id}>{item.dataset_name}</option>)}</select></label><button className="button button-secondary" onClick={runs.reload}><RefreshCw size={14} /> Muat ulang</button></div>
    {message && <div className="success-panel"><CheckCircle2 size={17} /><div><strong>Aktivasi berhasil</strong><span>{message}</span></div></div>}{error && <div className="form-error">{error}</div>}
    <GlassCard title="Daftar Eksekusi">{runs.loading ? <StatePanel type="loading" title="Memuat riwayat" message="Mengambil daftar eksekusi." /> : runs.error ? <StatePanel type="error" title="Riwayat belum tersedia" message={runs.error} /> : !runs.data?.length ? <StatePanel type="empty" title="Belum ada eksekusi" message="Hasil yang dibuat melalui DBSCAN Final akan muncul di sini." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Eksekusi</th><th>Eksperimen</th><th>Epsilon (km)</th><th>MinPts</th><th>Klaster</th><th>Persentase Noise</th><th>Skor Silhouette</th><th>Status</th><th>Aktif</th><th /></tr></thead><tbody>{runs.data.map((run) => <tr key={run.id} className={run.is_active ? 'job-row-recommended' : undefined}><td><div className="run-id-cell"><strong>#{run.id}</strong>{run.is_active && <span className="webgis-active-badge"><i /> Aktif di WebGIS</span>}</div><small className="table-sub">{formatDate(run.created_at)}</small></td><td>#{run.selected_experiment_id}</td><td>{formatNumber(run.eps_km, 2)}</td><td>{run.min_samples}</td><td>{run.cluster_count === null ? '—' : formatNumber(run.cluster_count)}</td><td>{run.noise_percentage === null ? '—' : `${formatNumber(run.noise_percentage, 2)}%`}</td><td>{formatNumber(run.silhouette_score, 4)}</td><td><StatusBadge status={run.status} /></td><td>{run.is_active ? <span className="active-label"><i /> Aktif</span> : '—'}</td><td><div className="table-actions"><button className="text-button" onClick={() => void showDetail(run.id)}>Rincian</button>{run.status === 'SUCCESS' && !run.is_active && <button className="text-button" disabled={IS_PREVIEW_MODE || busyRun === run.id} onClick={() => setConfirmingRun(run)}><Rocket size={13} />{busyRun === run.id ? 'Memproses…' : 'Aktifkan'}</button>}</div></td></tr>)}</tbody></table></div>}</GlassCard>
    {detailRunId !== null && <GlassCard title={`Rincian eksekusi #${detailRunId}`} subtitle="Informasi hasil eksekusi DBSCAN yang dipilih." action={<button className="icon-button" onClick={() => { setDetailRunId(null); setDetail(null); }} aria-label="Tutup detail">×</button>}>{detailLoading ? <StatePanel type="loading" title="Memuat rincian" message="Mengambil informasi eksekusi." /> : detailError ? <StatePanel type="error" title="Rincian tidak tersedia" message={detailError} /> : <RecordDetails record={detail || {}} />}</GlassCard>}

    <ConfirmModal
      isOpen={Boolean(confirmingRun)}
      variant="primary"
      title="Konfirmasi Publikasi WebGIS"
      icon={<Rocket size={22} />}
      confirmLabel="Ya, Aktifkan Hasil"
      cancelLabel="Batal"
      loading={busyRun !== null}
      onCancel={() => setConfirmingRun(null)}
      onConfirm={handleConfirmActivate}
      message={
        confirmingRun ? (
          <div>
            <p>
              Aktifkan <strong>Eksekusi DBSCAN Final #{confirmingRun.id}</strong> sebagai sumber data utama yang disajikan pada WebGIS publik?
            </p>
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(5, 17, 30, 0.65)', borderRadius: '10px', border: '1px solid rgba(72, 215, 237, 0.25)' }}>
              <div>Parameter: <strong>ε {formatNumber(confirmingRun.eps_km, 2)} km</strong> · <strong>MinPts {confirmingRun.min_samples}</strong></div>
              {confirmingRun.cluster_count != null && <div style={{ marginTop: '4px' }}>Hasil: <strong>{formatNumber(confirmingRun.cluster_count)} klaster</strong> · <strong>Noise {formatNumber(confirmingRun.noise_percentage, 2)}%</strong></div>}
            </div>
          </div>
        ) : null
      }
    />
  </div>;
}
