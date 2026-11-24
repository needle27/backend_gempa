import { Activity, ArrowRight, Database, ExternalLink, FileClock, Layers3, Rocket, ShieldCheck, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDatasets, getPublicMetadata, getPublicSummary } from '../../api/services';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatCard, StatusBadge, formatDate, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { IS_PREVIEW_MODE } from '../../config/env';
import { formatPercent } from '../../utils/presentation';

export function DashboardPage() {
  const datasets = useResource(getDatasets, []);
  const activePublic = useResource(async () => {
    try {
      const [metadata, summary] = await Promise.all([
        getPublicMetadata(),
        getPublicSummary(),
      ]);
      return { metadata, summary };
    } catch {
      return { metadata: null, summary: null };
    }
  }, []);

  const list = datasets.data || [];
  const totalRows = list.reduce((sum, item) => sum + item.cleaned_row_count, 0);
  const rejectedRows = list.reduce((sum, item) => sum + item.rejected_row_count, 0);

  const activeRun = activePublic.data?.metadata?.run;
  const activeSummary = activePublic.data?.summary;
  const activeDataset = activePublic.data?.metadata?.dataset;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMIN / RINGKASAN"
        title="Dashboard"
        description="Ringkasan pengelolaan dan publikasi hasil klasterisasi DBSCAN gempa Indonesia."
        action={<SimulationTag />}
      />

      {datasets.loading ? (
        <StatePanel type="loading" title="Memuat dashboard" message="Mengambil daftar dataset dan status publikasi." />
      ) : datasets.error ? (
        <StatePanel
          type="error"
          title="Dashboard belum terhubung"
          message={datasets.error}
          action={<button className="button button-secondary" onClick={() => { datasets.reload(); activePublic.reload(); }}>Coba lagi</button>}
        />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard label="Dataset tersimpan" value={formatNumber(list.length)} icon={<Database size={18} />} />
            <StatCard label="Baris bersih" value={formatNumber(totalRows)} icon={<Waves size={18} />} tone="violet" />
            <StatCard label="Baris ditolak" value={formatNumber(rejectedRows)} icon={<ShieldCheck size={18} />} tone="amber" />
            <StatCard
              label="Mode aplikasi"
              value={IS_PREVIEW_MODE ? 'Pratinjau' : 'Terhubung'}
              icon={<Activity size={18} />}
              tone="teal"
              trend={IS_PREVIEW_MODE ? 'Fitur perubahan data dinonaktifkan' : 'Layanan API terhubung'}
            />
          </div>

          {/* Kartu Sorotan: Hasil Klasterisasi Aktif di WebGIS Publik */}
          <GlassCard className="active-publication-card">
            <div className="active-publication-header">
              <div className="active-publication-title-area">
                <span className="eyebrow"><Rocket size={13} /> PUBLIKASI WEBGIS AKTIF</span>
                <h3 style={{ margin: '4px 0 2px', fontSize: '17px', color: '#f0f7fe' }}>
                  {activeRun ? `Hasil Klasterisasi Aktif #${activeRun.id}` : 'Hasil Klasterisasi Aktif'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                  {activeDataset?.name || activeSummary?.dataset_name
                    ? `Sumber: ${activeDataset?.name || activeSummary?.dataset_name} · ${activeDataset?.source_name || 'Katalog gempa'}`
                    : 'Rujukan data resmi yang saat ini disajikan kepada publik.'}
                </p>
              </div>
              <div className="active-publication-badge-area">
                {activeRun ? (
                  <span className="active-label"><i /> Sedang Tayang di WebGIS</span>
                ) : (
                  <StatusBadge status="NO_ACTIVE_RUN" />
                )}
              </div>
            </div>

            {activePublic.loading ? (
              <StatePanel type="loading" title="Memuat publikasi aktif" message="Mengambil rincian eksekusi aktif." />
            ) : activeRun && activeSummary ? (
              <>
                <div className="active-publication-grid">
                  <div className="active-publication-item">
                    <span>Epsilon (Jarak)</span>
                    <strong className="tabular-nums">{formatNumber(activeRun.eps_km, 2)} <small>km</small></strong>
                  </div>
                  <div className="active-publication-item">
                    <span>MinPts</span>
                    <strong className="tabular-nums">{formatNumber(activeRun.min_samples)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>Jumlah Klaster</span>
                    <strong className="tabular-nums">{formatNumber(activeSummary.cluster_count)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>Persentase Noise</span>
                    <strong className="tabular-nums">{formatPercent(activeSummary.noise_percentage, 2)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>Skor Silhouette</span>
                    <strong className="tabular-nums">
                      {activeSummary.silhouette_score != null ? formatNumber(activeSummary.silhouette_score, 4) : '—'}
                    </strong>
                  </div>
                  <div className="active-publication-item">
                    <span>Total Titik Gempa</span>
                    <strong className="tabular-nums">{formatNumber(activeSummary.total_points)}</strong>
                  </div>
                </div>

                <div className="active-publication-actions">
                  <Link to="/" className="button button-primary">
                    <ExternalLink size={14} /> Lihat di Peta Publik <ArrowRight size={13} />
                  </Link>
                  <Link to="/admin/riwayat-run" className="button button-secondary">
                    <FileClock size={14} /> Kelola di Riwayat Eksekusi
                  </Link>
                </div>
              </>
            ) : (
              <StatePanel
                type="info"
                title="Belum ada hasil klasterisasi aktif"
                message="WebGIS publik belum memiliki layer klaster yang diaktifkan. Jalankan klasterisasi final lalu aktifkan hasil terbaik pada Riwayat Eksekusi."
                action={
                  <Link to="/admin/dbscan-final" className="button button-primary">
                    <Rocket size={14} /> Jalankan DBSCAN Final <ArrowRight size={13} />
                  </Link>
                }
              />
            )}
          </GlassCard>

          <div className="dashboard-grid">
            <GlassCard
              title="Dataset terbaru"
              subtitle="Daftar dataset penelitian yang tersimpan."
              action={
                <Link to="/admin/dataset" className="inline-link">
                  Lihat semua <ArrowRight size={14} />
                </Link>
              }
            >
              {list.length ? (
                <div className="dataset-mini-list">
                  {list.slice(0, 4).map((item) => (
                    <div className="dataset-mini-row" key={item.id}>
                      <span className="dataset-mini-icon"><Database size={16} /></span>
                      <div className="dataset-mini-info">
                        <strong>{item.dataset_name}</strong>
                        <small>#{item.id} · {formatDate(item.created_at)}</small>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <StatePanel type="empty" title="Belum ada dataset" message="Unggah dataset CSV yang telah dibersihkan dari Jupyter Notebook." />
              )}
            </GlassCard>

            <GlassCard
              className="workflow-card"
              title="Alur Kerja Penelitian"
              subtitle="Tahapan pengelolaan hasil DBSCAN."
              action={<span className="workflow-icon"><Layers3 size={18} /></span>}
            >
              <div className="workflow-steps">
                <div>
                  <i>01</i>
                  <span><strong>Dataset</strong><small>Unggah CSV bersih</small></span>
                  <Link to="/admin/dataset">Buka</Link>
                </div>
                <div>
                  <i>02</i>
                  <span><strong>Pencarian parameter</strong><small>Eksperimen kandidat ε dan MinPts</small></span>
                  <Link to="/admin/parameter">Buka</Link>
                </div>
                <div>
                  <i>03</i>
                  <span><strong>DBSCAN Final</strong><small>Jalankan eksperimen terpilih</small></span>
                  <Link to="/admin/dbscan-final">Buka</Link>
                </div>
                <div>
                  <i>04</i>
                  <span><strong>Riwayat eksekusi</strong><small>Periksa dan aktifkan hasil yang berhasil</small></span>
                  <Link to="/admin/riwayat-run">Buka</Link>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="admin-note">
            <FileClock size={16} />
            <span>Catatan aktivitas tersedia pada menu Log Aktivitas. Status proses dapat dipantau setelah Pencarian Parameter atau DBSCAN Final dijalankan.</span>
          </div>
        </>
      )}
    </div>
  );
}
