import { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, CalendarRange, Compass, Layers3, Waves } from 'lucide-react';
import { getClusterProfiles, getPublicMetadata, getPublicSummary } from '../../api/services';
import {
  ClusterDistributionChart,
  ClusterScopeControl,
  ClusterShareChart,
  DepthAverageChart,
  DepthProfileChart,
  MagnitudeProfileChart,
  formatClusterScopeSubtitle,
  type ClusterChartScope,
} from '../../components/Charts';
import { GlassCard, PageHeader, SimulationTag, StatePanel, StatCard, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import { DEPTH_CATEGORY_COLORS } from '../../utils/clusterColors';

export function AnalysisPage() {
  const { lang, tx } = useI18n();
  const summary = useResource(getPublicSummary, []);
  const profiles = useResource(getClusterProfiles, []);
  const metadata = useResource(getPublicMetadata, []);
  const rows = profiles.data || [];
  const [profilePage, setProfilePage] = useState(1);
  const [profilePageSize, setProfilePageSize] = useState(10);
  const [distScope, setDistScope] = useState<ClusterChartScope>('top10');
  const [depthScope, setDepthScope] = useState<ClusterChartScope>('top10');
  const [avgScope, setAvgScope] = useState<ClusterChartScope>('top10');
  const totalProfilePages = Math.max(1, Math.ceil(rows.length / profilePageSize));
  const safeProfilePage = Math.min(profilePage, totalProfilePages);
  const pageStartIndex = rows.length === 0 ? 0 : (safeProfilePage - 1) * profilePageSize;
  const pageEndIndex = Math.min(pageStartIndex + profilePageSize, rows.length);
  const visibleRows = useMemo(
    () => rows.slice(pageStartIndex, pageEndIndex),
    [rows, pageStartIndex, pageEndIndex],
  );
  const totalProfileEvents = useMemo(() => rows.reduce((sum, item) => sum + item.event_count, 0), [rows]);
  const silhouetteSampleSize = summary.data?.silhouette_sample_size ?? metadata.data?.run?.silhouette_sample_size ?? null;

  useEffect(() => {
    setProfilePage(1);
  }, [rows.length, profilePageSize]);

  return <div className="page-stack public-analysis-page">
    <PageHeader eyebrow={tx('ANALISIS PUBLIK / PROFIL KLASTER', 'PUBLIC ANALYSIS / CLUSTER PROFILES')} title={tx('Analisis Spasial', 'Spatial Analysis')} description={tx('Pahami struktur klaster dan karakteristik kejadian gempa yang menyusunnya. Halaman ini memisahkan hasil pembentukan klaster dari analisis profil setelah klaster terbentuk.', 'Examine cluster structures and member earthquake characteristics. This view separates cluster formation from post-clustering profiling.')} action={<SimulationTag />} />

    <section className="analysis-lead glass-card">
      <div className="analysis-lead-icon"><Compass size={22} /></div>
      <div><span className="eyebrow">{tx('KERANGKA INTERPRETASI', 'INTERPRETATION FRAMEWORK')}</span><h2>{tx('Lokasi membentuk klaster; atribut menjelaskan karakteristiknya.', 'Location forms clusters; attributes explain their traits.')}</h2><p>{tx('DBSCAN mengelompokkan titik berdasarkan kepadatan tetangga pada ruang koordinat. Latitude dan longitude menjadi fitur dengan metrik Haversine. Setelah label terbentuk, magnitudo, kedalaman, waktu, dan lokasi dipakai untuk mendeskripsikan anggota — bukan menentukan keanggotaan klaster.', 'DBSCAN groups points by spatial neighbor density across coordinates using Latitude and Longitude with the Haversine metric. Once cluster labels are assigned, magnitude, depth, time span, and location describe members without influencing cluster membership.')}</p></div>
    </section>

    <section className="analysis-guide-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('METODE & PARAMETER', 'METHOD & PARAMETERS')}</span><h2>{tx('Apa yang membentuk klaster?', 'What forms the clusters?')}</h2><p className="section-description">{tx('Parameter aktual ditampilkan dari hasil aktif; penjelasan berikut membantu membaca perannya dalam DBSCAN.', 'Actual parameters come from the active run; explanations below clarify their role in DBSCAN.')}</p></div></div>
      <div className="parameter-explainer-grid">
        <article className="parameter-explainer glass-card"><span>EPSILON (ε)</span><strong>{metadata.data?.run ? `${formatNumber(metadata.data.run.eps_km, 2)} km` : tx('Dari hasil aktif', 'From active run')}</strong><p>{tx('Jarak maksimum pencarian tetangga. Titik dalam jarak epsilon menjadi bagian dari lingkungan spasial suatu titik.', 'Maximum neighbor search radius. Points within epsilon belong to a point’s spatial neighborhood.')}</p></article>
        <article className="parameter-explainer glass-card"><span>{tx('JUMLAH MINIMUM TITIK (MinPts)', 'MINIMUM POINTS (MinPts)')}</span><strong>{metadata.data?.run ? formatNumber(metadata.data.run.min_samples) : tx('Dari hasil aktif', 'From active run')}</strong><p>{tx('Jumlah minimum titik dalam lingkungan epsilon, termasuk titik itu sendiri, untuk memenuhi kriteria titik inti (core point).', 'Minimum points within the epsilon radius, including the point itself, required to qualify as a core point.')}</p></article>
        <article className="parameter-explainer glass-card"><span>{tx('METRIK JARAK', 'DISTANCE METRIC')}</span><strong>{metadata.data?.run?.metric?.toUpperCase() || 'HAVERSINE'}</strong><p>{tx('Menghitung jarak geografis dari pasangan koordinat Latitude dan Longitude, bukan jarak Euclidean pada bidang datar.', 'Computes geographic great-circle distance from Latitude and Longitude pairs rather than flat Euclidean distance.')}</p></article>
      </div>
      <div className="analysis-reading-note parameter-note">
        <BookOpen size={17} />
        <p>
          <strong>{tx('Evaluasi:', 'Evaluation:')}</strong> {tx('Skor Silhouette digunakan sebagai salah satu indikator evaluasi struktur klaster', 'The Silhouette Score serves as one indicator of cluster cohesion and separation')}
          {silhouetteSampleSize != null && silhouetteSampleSize > 0
            ? tx(
                <> dan dihitung pada sampel terstratifikasi sebanyak <strong className="tabular-nums">{formatNumber(silhouetteSampleSize)}</strong> titik non-noise menggunakan metrik Haversine</>,
                <> and is computed over a stratified sample of <strong className="tabular-nums">{formatNumber(silhouetteSampleSize)}</strong> non-noise points using the Haversine metric</>,
              )
            : null}
          {tx('. Baca nilainya bersama jumlah klaster, jumlah noise, distribusi anggota, dan konteks spasial; jangan menafsirkannya sendirian.', '. Read it alongside cluster count, noise count, member distribution, and spatial context rather than in isolation.')}
        </p>
      </div>
    </section>

    <section className="analysis-guide-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('CARA MEMBACA PROFIL', 'HOW TO READ PROFILES')}</span><h2>{tx('Empat sudut pandang analisis', 'Four analytical perspectives')}</h2></div></div>
      <div className="analysis-guide-grid">
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Layers3 size={18} /></span><h3>{tx('Jumlah anggota', 'Member count')}</h3><p>{tx('Menunjukkan banyaknya kejadian yang diberi label pada klaster. Perbedaan jumlah anggota menggambarkan ukuran kelompok pada dataset.', 'Shows how many events belong to a cluster. Size differences reflect cluster scale across the dataset.')}</p><small>{tx('Jumlah kejadian dalam klaster', 'Events inside cluster')}</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Waves size={18} /></span><h3>{tx('Magnitudo', 'Magnitude')}</h3><p>{tx('Rata-rata, minimum, dan maksimum membantu merangkum magnitudo kejadian yang menjadi anggota klaster.', 'Mean, minimum, and maximum summarize earthquake magnitudes within each cluster.')}</p><small>{tx('Rata-rata, magnitudo minimum, dan maksimum', 'Mean, min, and max magnitude')}</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Activity size={18} /></span><h3>{tx('Kedalaman', 'Depth')}</h3><p>{tx('Profil kedalaman memperlihatkan ringkasan nilai kedalaman dan pembagian kategori yang disediakan sistem.', 'Depth profiles summarize focal depths and breakdown across shallow, intermediate, and deep categories.')}</p><small>{tx('Rata-rata, kedalaman minimum dan maksimum, serta jumlah gempa dangkal, menengah, dan dalam', 'Mean, min/max depth, and shallow/intermediate/deep counts')}</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><CalendarRange size={18} /></span><h3>{tx('Waktu & lokasi', 'Time & location')}</h3><p>{tx('Rentang tanggal dan lokasi dominan memberi konteks temporal serta geografis pada anggota setiap klaster.', 'Date ranges and dominant regions give temporal and geographic context to cluster members.')}</p><small>{tx('Tanggal kejadian pertama dan terakhir', 'First and last event dates')}</small></article>
      </div>
    </section>

    <section className="analysis-results-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('HASIL DBSCAN AKTIF', 'ACTIVE DBSCAN RUN')}</span><h2>{tx('Visualisasi dan ringkasan data', 'Visualizations and data summary')}</h2><p className="section-description">{tx('Grafik dan tabel di bawah mengikuti nilai yang dikembalikan sistem untuk hasil yang sedang dipublikasikan.', 'Charts and tables below reflect metrics from the currently published DBSCAN run.')}</p></div></div>
      {summary.loading || profiles.loading ? <StatePanel type="loading" title={tx('Memuat analisis', 'Loading analysis')} message={tx('Mengambil ringkasan dan profil klaster dari sistem.', 'Fetching cluster summary and profiles from the system.')} /> : summary.error || profiles.error ? <StatePanel type="error" title={tx('Analisis belum tersedia', 'Analysis unavailable')} message={summary.error || profiles.error || tx('Sistem belum tersedia.', 'System is currently unavailable.')} /> : !summary.data || rows.length === 0 ? <StatePanel type="empty" title={tx('Belum ada profil klaster yang dipublikasikan', 'No published cluster profiles yet')} message={tx('Penjelasan metodologi tetap dapat dibaca. Grafik dan tabel akan terisi setelah sistem menyediakan profil dari hasil DBSCAN aktif berstatus Berhasil.', 'Methodology notes remain readable. Charts and tables populate once an active successful DBSCAN run provides profiles.')} /> : <>
        <div className="stats-grid">
          <StatCard label={tx('Total titik', 'Total points')} value={formatNumber(summary.data.total_points)} icon={<Waves size={18} />} trend={tx('Seluruh observasi pada hasil aktif', 'All observations in active run')} />
          <StatCard label={tx('Jumlah klaster', 'Cluster count')} value={formatNumber(summary.data.cluster_count)} icon={<Layers3 size={18} />} tone="violet" trend={tx('Kelompok spasial terbentuk', 'Spatial clusters formed')} />
          <StatCard label={tx('Titik Noise', 'Noise points')} value={formatNumber(summary.data.noise_count)} icon={<Activity size={18} />} tone="amber" trend={tx(`${formatNumber(summary.data.noise_percentage, 2)}% dari titik`, `${formatNumber(summary.data.noise_percentage, 2)}% of points`)} />
          <StatCard
            label={tx('Skor Silhouette', 'Silhouette Score')}
            value={summary.data.silhouette_score === null ? '—' : formatNumber(summary.data.silhouette_score, 4)}
            icon={<BookOpen size={18} />}
            tone="teal"
            trend={silhouetteSampleSize != null && silhouetteSampleSize > 0 ? tx(`Sampel ${formatNumber(silhouetteSampleSize)} titik non-noise`, `Sample of ${formatNumber(silhouetteSampleSize)} non-noise points`) : tx('Indikator evaluasi dari sistem', 'Evaluation metric from server')}
          />
        </div>
        <div className="profile-count-note"><Layers3 size={15} /><span><strong className="tabular-nums">{formatNumber(summary.data.profile_count)}</strong> {tx('profil klaster tersedia', 'cluster profiles available')} · <strong className="tabular-nums">{formatNumber(totalProfileEvents)}</strong> {tx('total anggota pada tabel profil.', 'total members in profile table.')}</span></div>
        <div className="charts-grid">
          <GlassCard title={tx('Jumlah anggota per klaster', 'Members per cluster')} subtitle={formatClusterScopeSubtitle(distScope, rows.length, undefined, lang)}>
            <ClusterDistributionChart profiles={rows} clusterScope={distScope} onClusterScopeChange={setDistScope} hideScopeSubtitle />
          </GlassCard>
          <GlassCard title={tx('Komposisi klaster', 'Cluster share')} subtitle={rows.length > 6 ? tx(`Enam klaster terbesar dan gabungan ${formatNumber(rows.length - 6)} klaster lainnya`, `Top six largest clusters plus ${formatNumber(rows.length - 6)} others combined`) : tx(`Proporsi seluruh ${formatNumber(rows.length)} klaster`, `Proportion of all ${formatNumber(rows.length)} clusters`)}>
            <ClusterShareChart profiles={rows} clusterCount={summary.data.cluster_count} />
          </GlassCard>
          <GlassCard title={tx('Profil kedalaman', 'Depth profile')} subtitle={formatClusterScopeSubtitle(depthScope, rows.length, undefined, lang)}>
            <DepthProfileChart profiles={rows} clusterScope={depthScope} onClusterScopeChange={setDepthScope} hideScopeSubtitle />
            <div className="chart-legend"><span><i style={{ background: DEPTH_CATEGORY_COLORS.shallow }} />{tx('Dangkal (0–<70 km)', 'Shallow (0–<70 km)')}</span><span><i style={{ background: DEPTH_CATEGORY_COLORS.medium }} />{tx('Menengah (70–<300 km)', 'Intermediate (70–<300 km)')}</span><span><i style={{ background: DEPTH_CATEGORY_COLORS.deep }} />{tx('Dalam (≥300 km)', 'Deep (≥300 km)')}</span></div>
          </GlassCard>
          <GlassCard title={tx('Profil rata-rata tiap klaster', 'Average profile per cluster')} subtitle={`${formatClusterScopeSubtitle(avgScope, rows.length, undefined, lang)} ${tx('Magnitudo dan kedalaman menggunakan skala masing-masing.', 'Magnitude and depth use independent scales.')}`}>
            <div className="chart-module">
              <ClusterScopeControl totalCount={rows.length} scope={avgScope} onChange={setAvgScope} hideSubtitle />
              <div className="trend-pair-grid">
                <section className="trend-mini-panel">
                  <div className="trend-mini-heading"><strong>{tx('Rata-rata magnitudo', 'Average magnitude')}</strong><span>{tx('Magnitudo (M)', 'Magnitude (M)')}</span></div>
                  <MagnitudeProfileChart profiles={rows} clusterScope={avgScope} hideScopeControl hideScopeSubtitle />
                </section>
                <section className="trend-mini-panel">
                  <div className="trend-mini-heading"><strong>{tx('Rata-rata kedalaman', 'Average depth')}</strong><span>{tx('Kilometer (km)', 'Kilometers (km)')}</span></div>
                  <DepthAverageChart profiles={rows} clusterScope={avgScope} hideScopeControl hideScopeSubtitle />
                </section>
              </div>
            </div>
          </GlassCard>
        </div>
        <GlassCard title={tx('Ringkasan profil klaster', 'Cluster profile summary')} subtitle={tx('Statistik magnitudo, kedalaman, dan radius merupakan profil setelah klasterisasi. Tanda — berarti nilai tidak tersedia.', 'Magnitude, depth, and radius statistics summarize post-clustering profiles. A dash (—) indicates unavailable data.')}>
          <div className="profile-table-toolbar">
            <p className="profile-table-count" aria-live="polite">
              {tx('Menampilkan', 'Showing')} <strong className="tabular-nums">{formatNumber(pageStartIndex + 1)}–{formatNumber(pageEndIndex)}</strong> {tx('dari', 'of')} <strong className="tabular-nums">{formatNumber(rows.length)}</strong> {tx('klaster', 'clusters')}
            </p>
            <label className="profile-table-size">
              <span>{tx('Baris per halaman', 'Rows per page')}</span>
              <select
                value={profilePageSize}
                onChange={(event) => {
                  setProfilePageSize(Number(event.target.value));
                  setProfilePage(1);
                }}
                aria-label={tx('Jumlah klaster per halaman', 'Clusters per page')}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>{tx('ID Klaster', 'Cluster ID')}</th><th>{tx('Anggota', 'Members')}</th><th>{tx('Rata-rata Magnitudo', 'Avg Magnitude')}</th><th>{tx('Magnitudo Minimum', 'Min Magnitude')}</th><th>{tx('Magnitudo Maksimum', 'Max Magnitude')}</th><th>{tx('Rata-rata Kedalaman', 'Avg Depth')}</th><th>{tx('Kedalaman Minimum', 'Min Depth')}</th><th>{tx('Kedalaman Maksimum', 'Max Depth')}</th><th>{tx('Dangkal', 'Shallow')}</th><th>{tx('Menengah', 'Intermediate')}</th><th>{tx('Dalam', 'Deep')}</th><th>{tx('Lokasi Terbanyak', 'Dominant Location')}</th><th>{tx('Titik Pusat (lintang, bujur)', 'Centroid (lat, lon)')}</th><th>{tx('Radius Rata-rata', 'Avg Radius')}</th><th>{tx('Radius Maks', 'Max Radius')}</th><th>{tx('Rentang Waktu Kejadian', 'Event Date Range')}</th></tr></thead><tbody>{visibleRows.map((item) => <tr key={item.cluster_id}><td><span className="cluster-pill">C{item.cluster_id}</span></td><td>{formatNumber(item.event_count)}</td><td>{formatNumber(item.avg_magnitude, 2)}</td><td>{formatNumber(item.min_magnitude, 2)}</td><td>{formatNumber(item.max_magnitude, 2)}</td><td>{item.avg_depth === null ? '—' : `${formatNumber(item.avg_depth, 1)} km`}</td><td>{item.min_depth === null ? '—' : `${formatNumber(item.min_depth, 1)} km`}</td><td>{item.max_depth === null ? '—' : `${formatNumber(item.max_depth, 1)} km`}</td><td>{formatNumber(item.shallow_event_count)}</td><td>{formatNumber(item.medium_event_count)}</td><td>{formatNumber(item.deep_event_count)}</td><td>{item.dominant_location || '—'}</td><td>{item.centroid_latitude === null || item.centroid_longitude === null ? '—' : `${formatNumber(item.centroid_latitude, 3)}, ${formatNumber(item.centroid_longitude, 3)}`}</td><td>{item.radius_km === null ? '—' : `${formatNumber(item.radius_km, 1)} km`}</td><td>{item.max_radius_km === null ? '—' : `${formatNumber(item.max_radius_km, 1)} km`}</td><td>{item.first_event_date || '—'} <span className="muted-text">→</span> {item.last_event_date || '—'}</td></tr>)}</tbody></table></div>
          <div className="profile-table-pagination">
            <span>{tx('Halaman', 'Page')} <strong className="tabular-nums">{formatNumber(safeProfilePage)}</strong> {tx('dari', 'of')} <strong className="tabular-nums">{formatNumber(totalProfilePages)}</strong></span>
            <div className="profile-table-pagination-actions">
              <button type="button" className="profile-page-button" disabled={safeProfilePage <= 1} onClick={() => setProfilePage((page) => Math.max(1, page - 1))}>{tx('Sebelumnya', 'Previous')}</button>
              <button type="button" className="profile-page-button" disabled={safeProfilePage >= totalProfilePages} onClick={() => setProfilePage((page) => Math.min(totalProfilePages, page + 1))}>{tx('Berikutnya', 'Next')}</button>
            </div>
          </div>
          <p className="muted-text" style={{ marginTop: 12 }}>{tx('Kategori kedalaman: dangkal 0–<70 km; menengah 70–<300 km; dalam ≥300 km (tidak digunakan sebagai fitur DBSCAN). Radius Rata-rata dan Radius Maks dihitung dari jarak Haversine anggota klaster terhadap titik pusatnya.', 'Depth categories: shallow 0–<70 km; intermediate 70–<300 km; deep ≥300 km (not used as DBSCAN clustering features). Avg Radius and Max Radius are measured via Haversine distance from cluster centroids.')}</p></GlassCard>
        <div className="analysis-reading-note"><BookOpen size={17} /><p><strong>{tx('Catatan interpretasi:', 'Interpretation note:')}</strong> {tx('ID klaster merupakan label identifikasi, bukan peringkat. Nilai rata-rata merangkum anggota klaster dan tidak menggambarkan setiap kejadian secara individual. Baca angka bersama distribusi spasial pada halaman Peta Klaster.', 'Cluster IDs are nominal identifiers, not severity rankings. Averages summarize group traits rather than individual events. Interpret figures alongside spatial distribution on the Cluster Map page.')}</p></div>
      </>}
    </section>
  </div>;
}
