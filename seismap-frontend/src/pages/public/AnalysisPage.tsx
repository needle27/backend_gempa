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
import { DEPTH_CATEGORY_COLORS } from '../../utils/clusterColors';

export function AnalysisPage() {
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
    <PageHeader eyebrow="ANALISIS PUBLIK / PROFIL KLASTER" title="Analisis Spasial" description="Pahami struktur klaster dan karakteristik kejadian gempa yang menyusunnya. Halaman ini memisahkan hasil pembentukan klaster dari analisis profil setelah klaster terbentuk." action={<SimulationTag />} />

    <section className="analysis-lead glass-card">
      <div className="analysis-lead-icon"><Compass size={22} /></div>
      <div><span className="eyebrow">KERANGKA INTERPRETASI</span><h2>Lokasi membentuk klaster; atribut menjelaskan karakteristiknya.</h2><p>DBSCAN mengelompokkan titik berdasarkan kepadatan tetangga pada ruang koordinat. Latitude dan longitude menjadi fitur dengan metrik Haversine. Setelah label terbentuk, magnitudo, kedalaman, waktu, dan lokasi dipakai untuk mendeskripsikan anggota — bukan menentukan keanggotaan klaster.</p></div>
    </section>

    <section className="analysis-guide-section">
      <div className="section-heading-row"><div><span className="eyebrow">METODE & PARAMETER</span><h2>Apa yang membentuk klaster?</h2><p className="section-description">Parameter aktual ditampilkan dari hasil aktif; penjelasan berikut membantu membaca perannya dalam DBSCAN.</p></div></div>
      <div className="parameter-explainer-grid">
        <article className="parameter-explainer glass-card"><span>EPSILON (ε)</span><strong>{metadata.data?.run ? `${formatNumber(metadata.data.run.eps_km, 2)} km` : 'Dari hasil aktif'}</strong><p>Jarak maksimum pencarian tetangga. Titik dalam jarak epsilon menjadi bagian dari lingkungan spasial suatu titik.</p></article>
        <article className="parameter-explainer glass-card"><span>JUMLAH MINIMUM TITIK (MinPts)</span><strong>{metadata.data?.run ? formatNumber(metadata.data.run.min_samples) : 'Dari hasil aktif'}</strong><p>Jumlah minimum titik dalam lingkungan epsilon, termasuk titik itu sendiri, untuk memenuhi kriteria titik inti (core point).</p></article>
        <article className="parameter-explainer glass-card"><span>METRIK JARAK</span><strong>{metadata.data?.run?.metric?.toUpperCase() || 'HAVERSINE'}</strong><p>Menghitung jarak geografis dari pasangan koordinat Latitude dan Longitude, bukan jarak Euclidean pada bidang datar.</p></article>
      </div>
      <div className="analysis-reading-note parameter-note">
        <BookOpen size={17} />
        <p>
          <strong>Evaluasi:</strong> Skor Silhouette digunakan sebagai salah satu indikator evaluasi struktur klaster
          {silhouetteSampleSize != null && silhouetteSampleSize > 0
            ? <> dan dihitung pada sampel terstratifikasi sebanyak <strong className="tabular-nums">{formatNumber(silhouetteSampleSize)}</strong> titik non-noise menggunakan metrik Haversine</>
            : null}
          . Baca nilainya bersama jumlah klaster, jumlah noise, distribusi anggota, dan konteks spasial; jangan menafsirkannya sendirian.
        </p>
      </div>
    </section>

    <section className="analysis-guide-section">
      <div className="section-heading-row"><div><span className="eyebrow">CARA MEMBACA PROFIL</span><h2>Empat sudut pandang analisis</h2></div></div>
      <div className="analysis-guide-grid">
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Layers3 size={18} /></span><h3>Jumlah anggota</h3><p>Menunjukkan banyaknya kejadian yang diberi label pada klaster. Perbedaan jumlah anggota menggambarkan ukuran kelompok pada dataset.</p><small>Jumlah kejadian dalam klaster</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Waves size={18} /></span><h3>Magnitudo</h3><p>Rata-rata, minimum, dan maksimum membantu merangkum magnitudo kejadian yang menjadi anggota klaster.</p><small>Rata-rata, magnitudo minimum, dan maksimum</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><Activity size={18} /></span><h3>Kedalaman</h3><p>Profil kedalaman memperlihatkan ringkasan nilai kedalaman dan pembagian kategori yang disediakan sistem.</p><small>Rata-rata, kedalaman minimum dan maksimum, serta jumlah gempa dangkal, menengah, dan dalam</small></article>
        <article className="analysis-guide-card glass-card"><span className="guide-icon"><CalendarRange size={18} /></span><h3>Waktu & lokasi</h3><p>Rentang tanggal dan lokasi dominan memberi konteks temporal serta geografis pada anggota setiap klaster.</p><small>Tanggal kejadian pertama dan terakhir</small></article>
      </div>
    </section>

    <section className="analysis-results-section">
      <div className="section-heading-row"><div><span className="eyebrow">HASIL DBSCAN AKTIF</span><h2>Visualisasi dan ringkasan data</h2><p className="section-description">Grafik dan tabel di bawah mengikuti nilai yang dikembalikan sistem untuk hasil yang sedang dipublikasikan.</p></div></div>
      {summary.loading || profiles.loading ? <StatePanel type="loading" title="Memuat analisis" message="Mengambil ringkasan dan profil klaster dari sistem." /> : summary.error || profiles.error ? <StatePanel type="error" title="Analisis belum tersedia" message={summary.error || profiles.error || 'Sistem belum tersedia.'} /> : !summary.data || rows.length === 0 ? <StatePanel type="empty" title="Belum ada profil klaster yang dipublikasikan" message="Penjelasan metodologi tetap dapat dibaca. Grafik dan tabel akan terisi setelah sistem menyediakan profil dari hasil DBSCAN aktif berstatus Berhasil." /> : <>
        <div className="stats-grid">
          <StatCard label="Total titik" value={formatNumber(summary.data.total_points)} icon={<Waves size={18} />} trend="Seluruh observasi pada hasil aktif" />
          <StatCard label="Jumlah klaster" value={formatNumber(summary.data.cluster_count)} icon={<Layers3 size={18} />} tone="violet" trend="Kelompok spasial terbentuk" />
          <StatCard label="Titik Noise" value={formatNumber(summary.data.noise_count)} icon={<Activity size={18} />} tone="amber" trend={`${formatNumber(summary.data.noise_percentage, 2)}% dari titik`} />
          <StatCard
            label="Skor Silhouette"
            value={summary.data.silhouette_score === null ? '—' : formatNumber(summary.data.silhouette_score, 4)}
            icon={<BookOpen size={18} />}
            tone="teal"
            trend={silhouetteSampleSize != null && silhouetteSampleSize > 0 ? `Sampel ${formatNumber(silhouetteSampleSize)} titik non-noise` : 'Indikator evaluasi dari sistem'}
          />
        </div>
        <div className="profile-count-note"><Layers3 size={15} /><span><strong className="tabular-nums">{formatNumber(summary.data.profile_count)}</strong> profil klaster tersedia · <strong className="tabular-nums">{formatNumber(totalProfileEvents)}</strong> total anggota pada tabel profil.</span></div>
        <div className="charts-grid">
          <GlassCard title="Jumlah anggota per klaster" subtitle={formatClusterScopeSubtitle(distScope, rows.length)}>
            <ClusterDistributionChart profiles={rows} clusterScope={distScope} onClusterScopeChange={setDistScope} hideScopeSubtitle />
          </GlassCard>
          <GlassCard title="Komposisi klaster" subtitle={rows.length > 6 ? `Enam klaster terbesar dan gabungan ${formatNumber(rows.length - 6)} klaster lainnya` : `Proporsi seluruh ${formatNumber(rows.length)} klaster`}>
            <ClusterShareChart profiles={rows} clusterCount={summary.data.cluster_count} />
          </GlassCard>
          <GlassCard title="Profil kedalaman" subtitle={formatClusterScopeSubtitle(depthScope, rows.length)}>
            <DepthProfileChart profiles={rows} clusterScope={depthScope} onClusterScopeChange={setDepthScope} hideScopeSubtitle />
            <div className="chart-legend"><span><i style={{ background: DEPTH_CATEGORY_COLORS.shallow }} />Dangkal (0–&lt;70 km)</span><span><i style={{ background: DEPTH_CATEGORY_COLORS.medium }} />Menengah (70–&lt;300 km)</span><span><i style={{ background: DEPTH_CATEGORY_COLORS.deep }} />Dalam (≥300 km)</span></div>
          </GlassCard>
          <GlassCard title="Profil rata-rata tiap klaster" subtitle={`${formatClusterScopeSubtitle(avgScope, rows.length)} Magnitudo dan kedalaman menggunakan skala masing-masing.`}>
            <div className="chart-module">
              <ClusterScopeControl totalCount={rows.length} scope={avgScope} onChange={setAvgScope} hideSubtitle />
              <div className="trend-pair-grid">
                <section className="trend-mini-panel">
                  <div className="trend-mini-heading"><strong>Rata-rata magnitudo</strong><span>Magnitudo (M)</span></div>
                  <MagnitudeProfileChart profiles={rows} clusterScope={avgScope} hideScopeControl hideScopeSubtitle />
                </section>
                <section className="trend-mini-panel">
                  <div className="trend-mini-heading"><strong>Rata-rata kedalaman</strong><span>Kilometer (km)</span></div>
                  <DepthAverageChart profiles={rows} clusterScope={avgScope} hideScopeControl hideScopeSubtitle />
                </section>
              </div>
            </div>
          </GlassCard>
        </div>
        <GlassCard title="Ringkasan profil klaster" subtitle="Statistik magnitudo, kedalaman, dan radius merupakan profil setelah klasterisasi. Tanda — berarti nilai tidak tersedia.">
          <div className="profile-table-toolbar">
            <p className="profile-table-count" aria-live="polite">
              Menampilkan <strong className="tabular-nums">{formatNumber(pageStartIndex + 1)}–{formatNumber(pageEndIndex)}</strong> dari <strong className="tabular-nums">{formatNumber(rows.length)}</strong> klaster
            </p>
            <label className="profile-table-size">
              <span>Baris per halaman</span>
              <select
                value={profilePageSize}
                onChange={(event) => {
                  setProfilePageSize(Number(event.target.value));
                  setProfilePage(1);
                }}
                aria-label="Jumlah klaster per halaman"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>ID Klaster</th><th>Anggota</th><th>Rata-rata Magnitudo</th><th>Magnitudo Minimum</th><th>Magnitudo Maksimum</th><th>Rata-rata Kedalaman</th><th>Kedalaman Minimum</th><th>Kedalaman Maksimum</th><th>Dangkal</th><th>Menengah</th><th>Dalam</th><th>Lokasi Terbanyak</th><th>Titik Pusat (lintang, bujur)</th><th>Radius Rata-rata</th><th>Radius Maks</th><th>Rentang Waktu Kejadian</th></tr></thead><tbody>{visibleRows.map((item) => <tr key={item.cluster_id}><td><span className="cluster-pill">C{item.cluster_id}</span></td><td>{formatNumber(item.event_count)}</td><td>{formatNumber(item.avg_magnitude, 2)}</td><td>{formatNumber(item.min_magnitude, 2)}</td><td>{formatNumber(item.max_magnitude, 2)}</td><td>{item.avg_depth === null ? '—' : `${formatNumber(item.avg_depth, 1)} km`}</td><td>{item.min_depth === null ? '—' : `${formatNumber(item.min_depth, 1)} km`}</td><td>{item.max_depth === null ? '—' : `${formatNumber(item.max_depth, 1)} km`}</td><td>{formatNumber(item.shallow_event_count)}</td><td>{formatNumber(item.medium_event_count)}</td><td>{formatNumber(item.deep_event_count)}</td><td>{item.dominant_location || '—'}</td><td>{item.centroid_latitude === null || item.centroid_longitude === null ? '—' : `${formatNumber(item.centroid_latitude, 3)}, ${formatNumber(item.centroid_longitude, 3)}`}</td><td>{item.radius_km === null ? '—' : `${formatNumber(item.radius_km, 1)} km`}</td><td>{item.max_radius_km === null ? '—' : `${formatNumber(item.max_radius_km, 1)} km`}</td><td>{item.first_event_date || '—'} <span className="muted-text">→</span> {item.last_event_date || '—'}</td></tr>)}</tbody></table></div>
          <div className="profile-table-pagination">
            <span>Halaman <strong className="tabular-nums">{formatNumber(safeProfilePage)}</strong> dari <strong className="tabular-nums">{formatNumber(totalProfilePages)}</strong></span>
            <div className="profile-table-pagination-actions">
              <button type="button" className="profile-page-button" disabled={safeProfilePage <= 1} onClick={() => setProfilePage((page) => Math.max(1, page - 1))}>Sebelumnya</button>
              <button type="button" className="profile-page-button" disabled={safeProfilePage >= totalProfilePages} onClick={() => setProfilePage((page) => Math.min(totalProfilePages, page + 1))}>Berikutnya</button>
            </div>
          </div>
          <p className="muted-text" style={{ marginTop: 12 }}>Kategori kedalaman: dangkal 0–&lt;70 km; menengah 70–&lt;300 km; dalam ≥300 km (tidak digunakan sebagai fitur DBSCAN). Radius Rata-rata dan Radius Maks dihitung dari jarak Haversine anggota klaster terhadap titik pusatnya.</p></GlassCard>
        <div className="analysis-reading-note"><BookOpen size={17} /><p><strong>Catatan interpretasi:</strong> ID klaster merupakan label identifikasi, bukan peringkat. Nilai rata-rata merangkum anggota klaster dan tidak menggambarkan setiap kejadian secara individual. Baca angka bersama distribusi spasial pada halaman Peta Klaster.</p></div>
      </>}
    </section>
  </div>;
}
