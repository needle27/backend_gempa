import { useState } from 'react';
import { CheckCircle2, RefreshCw, Rocket } from 'lucide-react';
import { activateRun, getDatasets, getRunDetail, getRuns } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { usePipeline } from '../../context/PipelineContext';
import { useResource } from '../../hooks/useResource';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { useI18n } from '../../i18n/LanguageContext';
import type { DBSCANRun } from '../../types/domain';

export function RunHistoryPage() {
  const { tx } = useI18n();
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
    catch (reason) { setDetailError(reason instanceof Error ? reason.message : tx('Rincian eksekusi tidak dapat dimuat.', 'Unable to load execution details.')); }
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
      setMessage(tx(`Hasil #${runId} berhasil diaktifkan sebagai rujukan WebGIS publik.`, `Run #${runId} has been activated as the public WebGIS source.`));
      runs.reload();
      setConfirmingRun(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tx('Hasil gagal diaktifkan.', 'Failed to activate run.'));
    } finally {
      setBusyRun(null);
    }
  };

  return <div className="page-stack">
    <PageHeader eyebrow={tx('ADMIN / RIWAYAT EKSEKUSI', 'ADMIN / EXECUTION HISTORY')} title={tx('Riwayat Eksekusi', 'Execution History')} description={tx('Tinjau hasil DBSCAN dan tentukan hasil yang akan ditampilkan pada WebGIS publik.', 'Review DBSCAN runs and choose which result is published to the public WebGIS.')} action={<SimulationTag />} />
    <div className="run-filter glass-card"><label>Dataset<select value={datasetId ?? ''} onChange={(e) => setSelectedDatasetId(Number(e.target.value) || null)}><option value="">{tx('Pilih dataset', 'Select dataset')}</option>{datasets.data?.map((item) => <option key={item.id} value={item.id}>{item.dataset_name}</option>)}</select></label><button className="button button-secondary" onClick={runs.reload}><RefreshCw size={14} /> {tx('Muat ulang', 'Reload')}</button></div>
    {message && <div className="success-panel"><CheckCircle2 size={17} /><div><strong>{tx('Aktivasi berhasil', 'Activation successful')}</strong><span>{message}</span></div></div>}{error && <div className="form-error">{error}</div>}
    <GlassCard title={tx('Daftar Eksekusi', 'Execution List')}>{runs.loading ? <StatePanel type="loading" title={tx('Memuat riwayat', 'Loading history')} message={tx('Mengambil daftar eksekusi.', 'Fetching execution history.')} /> : runs.error ? <StatePanel type="error" title={tx('Riwayat belum tersedia', 'History unavailable')} message={runs.error} /> : !runs.data?.length ? <StatePanel type="empty" title={tx('Belum ada eksekusi', 'No runs yet')} message={tx('Hasil yang dibuat melalui DBSCAN Final akan muncul di sini.', 'Runs created through Final DBSCAN will appear here.')} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{tx('Eksekusi', 'Run')}</th><th>{tx('Eksperimen', 'Experiment')}</th><th>Epsilon (km)</th><th>MinPts</th><th>{tx('Klaster', 'Clusters')}</th><th>{tx('Persentase Noise', 'Noise Percentage')}</th><th>{tx('Skor Silhouette', 'Silhouette Score')}</th><th>Status</th><th>{tx('Aktif', 'Active')}</th><th /></tr></thead><tbody>{runs.data.map((run) => <tr key={run.id} className={run.is_active ? 'job-row-recommended' : undefined}><td><div className="run-id-cell"><strong>#{run.id}</strong>{run.is_active && <span className="webgis-active-badge"><i /> {tx('Aktif di WebGIS', 'Live on WebGIS')}</span>}</div><small className="table-sub">{formatDate(run.created_at)}</small></td><td>#{run.selected_experiment_id}</td><td>{formatNumber(run.eps_km, 2)}</td><td>{run.min_samples}</td><td>{run.cluster_count === null ? '—' : formatNumber(run.cluster_count)}</td><td>{run.noise_percentage === null ? '—' : `${formatNumber(run.noise_percentage, 2)}%`}</td><td>{formatNumber(run.silhouette_score, 4)}</td><td><StatusBadge status={run.status} /></td><td>{run.is_active ? <span className="active-label"><i /> {tx('Aktif', 'Active')}</span> : '—'}</td><td><div className="table-actions"><button className="text-button" onClick={() => void showDetail(run.id)}>{tx('Rincian', 'Details')}</button>{run.status === 'SUCCESS' && !run.is_active && <button className="text-button" disabled={IS_PREVIEW_MODE || busyRun === run.id} onClick={() => setConfirmingRun(run)}><Rocket size={13} />{busyRun === run.id ? tx('Memproses…', 'Processing…') : tx('Aktifkan', 'Activate')}</button>}</div></td></tr>)}</tbody></table></div>}</GlassCard>
    {detailRunId !== null && <GlassCard title={tx(`Rincian eksekusi #${detailRunId}`, `Execution #${detailRunId} Details`)} subtitle={tx('Informasi hasil eksekusi DBSCAN yang dipilih.', 'Details of the selected DBSCAN execution.')} action={<button className="icon-button" onClick={() => { setDetailRunId(null); setDetail(null); }} aria-label={tx('Tutup detail', 'Close details')}>×</button>}>{detailLoading ? <StatePanel type="loading" title={tx('Memuat rincian', 'Loading details')} message={tx('Mengambil informasi eksekusi.', 'Fetching execution information.')} /> : detailError ? <StatePanel type="error" title={tx('Rincian tidak tersedia', 'Details unavailable')} message={detailError} /> : <RecordDetails record={detail || {}} />}</GlassCard>}

    <ConfirmModal
      isOpen={Boolean(confirmingRun)}
      variant="primary"
      title={tx('Konfirmasi Publikasi WebGIS', 'Confirm WebGIS Publication')}
      icon={<Rocket size={22} />}
      confirmLabel={tx('Ya, Aktifkan Hasil', 'Yes, Activate Run')}
      cancelLabel={tx('Batal', 'Cancel')}
      loading={busyRun !== null}
      onCancel={() => setConfirmingRun(null)}
      onConfirm={handleConfirmActivate}
      message={
        confirmingRun ? (
          <div>
            <p>
              {tx(
                <>Aktifkan <strong>Eksekusi DBSCAN Final #{confirmingRun.id}</strong> sebagai sumber data utama yang disajikan pada WebGIS publik?</>,
                <>Activate <strong>Final DBSCAN Run #{confirmingRun.id}</strong> as the primary data source presented on the public WebGIS?</>,
              )}
            </p>
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(5, 17, 30, 0.65)', borderRadius: '10px', border: '1px solid rgba(72, 215, 237, 0.25)' }}>
              <div>{tx('Parameter:', 'Parameters:')} <strong>ε {formatNumber(confirmingRun.eps_km, 2)} km</strong> · <strong>MinPts {confirmingRun.min_samples}</strong></div>
              {confirmingRun.cluster_count != null && <div style={{ marginTop: '4px' }}>{tx('Hasil:', 'Results:')} <strong>{formatNumber(confirmingRun.cluster_count)} {tx('klaster', 'clusters')}</strong> · <strong>Noise {formatNumber(confirmingRun.noise_percentage, 2)}%</strong></div>}
            </div>
          </div>
        ) : null
      }
    />
  </div>;
}
