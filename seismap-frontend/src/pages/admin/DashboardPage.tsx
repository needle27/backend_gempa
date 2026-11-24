import { ArrowRight, Database, ExternalLink, FileClock, Layers3, Rocket, ShieldCheck, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDatasets, getPublicMetadata, getPublicSummary } from '../../api/services';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatCard, StatusBadge, formatDate, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n/types';
import { formatPercent } from '../../utils/presentation';

const INSTITUTION_ACRONYMS = new Set(['bmkg', 'usgs', 'noaa', 'isc', 'emsc', 'gfz', 'bnpb', 'brin', 'inatews', 'csv', 'api']);

function formatSourceInstitution(raw: string | null | undefined, lang: Language): string {
  const trimmed = raw?.trim();
  if (!trimmed) return lang === 'en' ? 'Earthquake Catalog' : 'Katalog Gempa';
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (INSTITUTION_ACRONYMS.has(lower)) return lower.toUpperCase();
      return word === lower ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(' ');
}

function silhouetteQualityLabel(score: number | null | undefined, lang: Language): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '';
  if (lang === 'en') {
    if (score >= 0.5) return 'strong';
    if (score >= 0.25) return 'fair';
    return 'weak';
  }
  if (score >= 0.5) return 'baik';
  if (score >= 0.25) return 'cukup';
  return 'lemah';
}

export function DashboardPage() {
  const { lang, tx } = useI18n();
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
  const clusteredPct = activeSummary ? Math.max(0, Math.min(100, 100 - activeSummary.noise_percentage)) : 0;
  const qualityLabel = activeSummary ? silhouetteQualityLabel(activeSummary.silhouette_score, lang) : '';

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={tx('ADMIN / RINGKASAN', 'ADMIN / OVERVIEW')}
        title="Dashboard"
        description={tx('Ringkasan pengelolaan dan publikasi hasil klasterisasi DBSCAN gempa Indonesia.', 'Summary of dataset management and publication of Indonesia earthquake DBSCAN clustering results.')}
        action={<SimulationTag />}
      />

      {datasets.loading ? (
        <StatePanel type="loading" title={tx('Memuat dashboard', 'Loading dashboard')} message={tx('Mengambil daftar dataset dan status publikasi.', 'Fetching datasets and active publication status.')} />
      ) : datasets.error ? (
        <StatePanel
          type="error"
          title={tx('Dashboard belum terhubung', 'Dashboard unavailable')}
          message={datasets.error}
          action={<button className="button button-secondary" onClick={() => { datasets.reload(); activePublic.reload(); }}>{tx('Coba lagi', 'Try again')}</button>}
        />
      ) : (
        <>
          <div className="stats-grid stats-grid-three">
            <StatCard label={tx('Dataset Tersimpan', 'Stored Datasets')} value={formatNumber(list.length)} icon={<Database size={18} />} />
            <StatCard label={tx('Baris Bersih', 'Clean Rows')} value={formatNumber(totalRows)} icon={<Waves size={18} />} tone="violet" />
            <StatCard label={tx('Baris Ditolak', 'Rejected Rows')} value={formatNumber(rejectedRows)} icon={<ShieldCheck size={18} />} tone="amber" />
          </div>

          {/* Kartu Sorotan: Hasil Klasterisasi Aktif di WebGIS Publik */}
          <GlassCard className="active-publication-card">
            <div className="active-publication-header">
              <div className="active-publication-title-area">
                <span className="eyebrow"><Rocket size={13} /> {tx('PUBLIKASI WEBGIS AKTIF', 'ACTIVE WEBGIS PUBLICATION')}</span>
                <h3 style={{ margin: '4px 0 2px', fontSize: '17px', color: '#f0f7fe' }}>
                  {activeRun ? tx(`Hasil Klasterisasi Aktif #${activeRun.id}`, `Active Clustering Run #${activeRun.id}`) : tx('Hasil Klasterisasi Aktif', 'Active Clustering Run')}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                  {activeDataset?.name || activeSummary?.dataset_name
                    ? `${tx('Sumber:', 'Source:')} ${activeDataset?.name || activeSummary?.dataset_name} · ${formatSourceInstitution(activeDataset?.source_name, lang)}`
                    : tx('Rujukan data resmi yang saat ini disajikan kepada publik.', 'Official research reference currently published to the public.')}
                </p>
              </div>
              <div className="active-publication-badge-area">
                {activeRun ? (
                  <span className="active-label"><i /> {tx('Sedang Tayang di WebGIS', 'Live on WebGIS')}</span>
                ) : (
                  <StatusBadge status="NO_ACTIVE_RUN" />
                )}
              </div>
            </div>

            {activePublic.loading ? (
              <StatePanel type="loading" title={tx('Memuat publikasi aktif', 'Loading active publication')} message={tx('Mengambil rincian eksekusi aktif.', 'Fetching active execution details.')} />
            ) : activeRun && activeSummary ? (
              <>
                <div className="active-publication-grid">
                  <div className="active-publication-item">
                    <span>{tx('Epsilon (Jarak)', 'Epsilon (Distance)')}</span>
                    <strong className="tabular-nums">{formatNumber(activeRun.eps_km, 2)} <small>km</small></strong>
                  </div>
                  <div className="active-publication-item">
                    <span>MinPts</span>
                    <strong className="tabular-nums">{formatNumber(activeRun.min_samples)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>{tx('Jumlah Klaster', 'Cluster Count')}</span>
                    <strong className="tabular-nums">{formatNumber(activeSummary.cluster_count)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>{tx('Persentase Noise', 'Noise Percentage')}</span>
                    <strong className="tabular-nums">{formatPercent(activeSummary.noise_percentage, 2)}</strong>
                  </div>
                  <div className="active-publication-item">
                    <span>{tx('Skor Silhouette', 'Silhouette Score')}</span>
                    <strong className="tabular-nums">
                      {activeSummary.silhouette_score != null ? formatNumber(activeSummary.silhouette_score, 4) : '—'}
                    </strong>
                  </div>
                  <div className="active-publication-item">
                    <span>{tx('Total Titik Gempa', 'Total Earthquakes')}</span>
                    <strong className="tabular-nums">{formatNumber(activeSummary.total_points)}</strong>
                  </div>
                </div>

                <p className="active-publication-summary tabular-nums">
                  {tx(
                    `Terbentuk ${formatNumber(activeSummary.cluster_count)} klaster spasial (${formatPercent(clusteredPct, 2)} kejadian terklasterisasi)${qualityLabel ? ` dengan pemisahan klaster yang ${qualityLabel}.` : '.'}`,
                    `Formed ${formatNumber(activeSummary.cluster_count)} spatial clusters (${formatPercent(clusteredPct, 2)} clustered events)${qualityLabel ? ` with ${qualityLabel} cluster separation.` : '.'}`,
                  )}
                </p>

                <div className="active-publication-actions">
                  <Link to="/" className="button button-primary">
                    <ExternalLink size={14} /> {tx('Lihat di Peta Publik', 'View on Public Map')}
                  </Link>
                  <Link to="/admin/riwayat-run" className="button button-secondary">
                    <FileClock size={14} /> {tx('Kelola di Riwayat Eksekusi', 'Manage in Execution History')}
                  </Link>
                </div>
              </>
            ) : (
              <StatePanel
                type="info"
                title={tx('Belum ada hasil klasterisasi aktif', 'No active clustering result')}
                message={tx('WebGIS publik belum memiliki layer klaster yang diaktifkan. Jalankan klasterisasi final lalu aktifkan hasil terbaik pada Riwayat Eksekusi.', 'Public WebGIS has no active cluster layer yet. Run final clustering and activate the best run in Execution History.')}
                action={
                  <Link to="/admin/dbscan-final" className="button button-primary">
                    <Rocket size={14} /> {tx('Jalankan DBSCAN Final', 'Run Final DBSCAN')} <ArrowRight size={13} />
                  </Link>
                }
              />
            )}
          </GlassCard>

          <div className="dashboard-grid">
            <GlassCard
              title={tx('Dataset Terbaru', 'Latest Datasets')}
              action={
                <Link to="/admin/dataset" className="inline-link">
                  {tx('Lihat semua', 'View all')} <ArrowRight size={14} />
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
                <StatePanel type="empty" title={tx('Belum ada dataset', 'No datasets yet')} message={tx('Unggah file CSV hasil prapemrosesan.', 'Upload a preprocessed CSV dataset.')} />
              )}
            </GlassCard>

            <GlassCard
              className="workflow-card"
              title={tx('Alur Kerja Penelitian', 'Research Workflow')}
              action={<span className="workflow-icon"><Layers3 size={18} /></span>}
            >
              <div className="workflow-steps">
                <div>
                  <i>01</i>
                  <span><strong>{tx('Dataset', 'Datasets')}</strong><small>{tx('Unggah dataset gempa (CSV)', 'Upload earthquake dataset (CSV)')}</small></span>
                  <Link to="/admin/dataset">{tx('Buka', 'Open')}</Link>
                </div>
                <div>
                  <i>02</i>
                  <span><strong>{tx('Pencarian Parameter', 'Parameter Search')}</strong><small>{tx('Eksperimen kandidat ε dan MinPts', 'Experiment with ε and MinPts candidates')}</small></span>
                  <Link to="/admin/parameter">{tx('Buka', 'Open')}</Link>
                </div>
                <div>
                  <i>03</i>
                  <span><strong>{tx('DBSCAN Final', 'Final DBSCAN')}</strong><small>{tx('Jalankan eksperimen terpilih', 'Execute selected valid experiment')}</small></span>
                  <Link to="/admin/dbscan-final">{tx('Buka', 'Open')}</Link>
                </div>
                <div>
                  <i>04</i>
                  <span><strong>{tx('Riwayat Eksekusi', 'Execution History')}</strong><small>{tx('Periksa dan aktifkan hasil klasterisasi', 'Inspect and activate clustering runs')}</small></span>
                  <Link to="/admin/riwayat-run">{tx('Buka', 'Open')}</Link>
                </div>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
