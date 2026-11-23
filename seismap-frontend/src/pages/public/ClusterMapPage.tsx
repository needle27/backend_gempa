import { useEffect, useMemo, useState } from 'react';
import { Compass, Crosshair, Filter, Info, LocateFixed, MapPinned, RefreshCw, X } from 'lucide-react';
import { getPublicMetadata, getPublicSummary, getResearchEarthquakes } from '../../api/services';
import { ClusterMap } from '../../components/ClusterMap';
import { PageHeader, SimulationTag, StatePanel, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { statusLabel } from '../../utils/presentation';
import { clusterColor, NOISE_COLOR } from '../../utils/clusterColors';

const MAP_API_PAGE_SIZE = 5000;

async function getAllResearchEarthquakes(totalPoints: number) {
  const totalPages = Math.max(1, Math.ceil(totalPoints / MAP_API_PAGE_SIZE));
  const pageResults = await Promise.all(
    Array.from({ length: totalPages }, (_, index) =>
      getResearchEarthquakes(index + 1, MAP_API_PAGE_SIZE),
    ),
  );
  return pageResults.flat();
}

export function ClusterMapPage() {
  const metadata = useResource(getPublicMetadata, []);
  const summary = useResource(getPublicSummary, []);
  const [clusterFilter, setClusterFilter] = useState('all');
  const [noiseOnly, setNoiseOnly] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const totalPoints = summary.data?.total_points ?? 0;
  const points = useResource(
    () => metadata.data?.run ? getAllResearchEarthquakes(totalPoints) : Promise.resolve([]),
    [metadata.data?.run?.id, totalPoints],
  );
  const filtered = useMemo(() => (points.data || []).filter((point) => {
    if (noiseOnly && !point.is_noise && point.cluster_id !== -1) return false;
    if (clusterFilter !== 'all' && String(point.cluster_id) !== clusterFilter) return false;
    return true;
  }), [points.data, clusterFilter, noiseOnly]);
  const clusters = [...new Set((points.data || []).filter((p) => p.cluster_id !== -1).map((p) => p.cluster_id))].sort((a, b) => a - b);

  const activeFilterCount = (clusterFilter !== 'all' ? 1 : 0) + (noiseOnly ? 1 : 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    if (isDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  return <div className="page-stack public-map-page">
    <PageHeader eyebrow="WEBGIS PUBLIK / KLASTER SPASIAL" title="Peta Klaster" description="Jelajahi lokasi kejadian gempa dan hasil pengelompokan spasial DBSCAN pada cakupan wilayah penelitian Indonesia." action={<SimulationTag />} />

    <section className="map-explainer glass-card">
      <div className="map-explainer-heading"><span className="map-explainer-icon"><MapPinned size={20} /></span><div><span className="eyebrow">PANDUAN PETA</span><h2>Setiap titik punya konteks spasial</h2><p>Peta menampilkan kejadian dari dataset penelitian pada hasil DBSCAN aktif. Pilih klaster untuk memusatkan perhatian atau tampilkan Noise secara terpisah.</p></div></div>
      <div className="map-explainer-grid">
        <article><span className="map-key cluster-key" /><div><strong>Anggota klaster</strong><p>Warna marker membedakan kelompok. Nomor ID klaster adalah label identitas, bukan urutan atau tingkat bahaya.</p></div></article>
        <article><span className="map-key noise-key" /><div><strong>Noise (−1)</strong><p>Titik yang tidak masuk ke kelompok berdasarkan kombinasi parameter DBSCAN pada hasil tersebut.</p></div></article>
        <article><span className="map-key coordinate-key"><Crosshair size={14} /></span><div><strong>Posisi kejadian</strong><p>Marker ditempatkan berdasarkan latitude dan longitude dari data penelitian.</p></div></article>
      </div>
    </section>

    <div className="map-scope-strip"><span><Compass size={15} />METODE: DBSCAN · HAVERSINE</span><span><MapPinned size={15} />CAKUPAN: LAT −15° s.d. 10° · LON 90° s.d. 145°</span><span><Info size={15} />SUMBER: DATASET PENELITIAN 2021–2025</span></div>

    {metadata.loading || (points.loading && !points.data) ? <StatePanel type="loading" title="Memuat seluruh titik gempa" message="Mengambil seluruh data secara bertahap dari API agar semua kejadian tampil pada satu peta." /> : metadata.error || points.error ? <StatePanel type="error" title="Peta belum dapat ditampilkan" message={metadata.error || points.error || 'Sistem belum tersedia.'} action={<button className="button button-secondary" onClick={() => { metadata.reload(); points.reload(); }}><RefreshCw size={15} /> Coba lagi</button>} /> : !metadata.data?.run ? <StatePanel type="empty" title="Belum ada hasil penelitian yang dipublikasikan" message="Peta akan menampilkan titik dan label klaster setelah admin mengaktifkan hasil DBSCAN berstatus Berhasil. Informasi gempa terkini BMKG tidak digunakan sebagai pengganti dataset penelitian." /> : <>
      {summary.data && <div className="map-run-summary"><div><span>JUMLAH TITIK</span><strong>{formatNumber(summary.data.total_points)}</strong></div><div><span>JUMLAH KLASTER</span><strong>{formatNumber(summary.data.cluster_count)}</strong></div><div><span>TITIK NOISE</span><strong>{formatNumber(summary.data.noise_count)} <small>({formatNumber(summary.data.noise_percentage, 1)}%)</small></strong></div></div>}
      
      {/* Desktop Toolbar (>= lg) */}
      <div className="map-toolbar glass-card"><div className="map-toolbar-title"><span className="live-indicator" /><div><strong>Peta penelitian Indonesia</strong><small>Hasil #{metadata.data.run.id} · {metadata.data.run.metric} · status {statusLabel(metadata.data.run.status)}</small></div></div><div className="map-filters"><label><Filter size={14} /><select value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)}><option value="all">Semua klaster</option>{clusters.map((id) => <option key={id} value={id}>Klaster {id}</option>)}</select></label><label className="toggle-label"><input type="checkbox" checked={noiseOnly} onChange={(e) => setNoiseOnly(e.target.checked)} /> Hanya Noise</label><button className="icon-button" onClick={() => { setClusterFilter('all'); setNoiseOnly(false); }} aria-label="Reset filter"><RefreshCw size={15} /></button></div></div>
      
      {/* Mobile Floating Filter Button (< lg) */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="map-floating-filter-btn fixed bottom-5 left-4 z-[1050] lg:hidden"
        aria-label="Buka filter peta"
      >
        <Filter size={16} />
        <span>Filter</span>
        {activeFilterCount > 0 && (
          <span className="filter-badge">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Mobile Backdrop (< lg) */}
      {isDrawerOpen && (
        <div
          className="map-drawer-backdrop fixed inset-0 z-[1100] bg-black/40 lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="map-page-layout">
        <div className="map-main-panel glass-card">
          <ClusterMap points={filtered} className="h-[100dvh]" />
          <div className="map-legend">{clusters.slice(0, 8).map((clusterId) => <span key={clusterId}><i className="legend-dot" style={{ backgroundColor: clusterColor(clusterId) }} />Klaster {clusterId}</span>)}{clusters.length > 8 && <span className="legend-more">+{clusters.length - 8} klaster lainnya</span>}<span><i className="legend-dot" style={{ backgroundColor: NOISE_COLOR }} />Noise (−1)</span></div>
          <div className="map-all-points-note">
            Menampilkan seluruh {formatNumber(points.data?.length ?? 0)} titik gempa pada hasil aktif.
          </div>
        </div>

        {/* Sidebar Desktop (>= lg) / Slide-Over Drawer Mobile (< lg) */}
        <aside
          className={`map-side-panel map-drawer-mobile fixed inset-y-0 left-0 w-[85vw] max-w-sm z-[1200] transition-transform duration-200 overflow-y-auto overscroll-contain lg:static lg:w-auto lg:max-w-none lg:z-auto lg:translate-x-0 ${
            isDrawerOpen ? 'translate-x-0 drawer-open' : '-translate-x-full drawer-closed'
          }`}
        >
          {/* Mobile Drawer Header (< lg) */}
          <div className="map-drawer-header lg:hidden">
            <div className="map-drawer-title">
              <Filter size={16} />
              <span>Filter & Parameter</span>
              {activeFilterCount > 0 && (
                <span className="filter-badge">{activeFilterCount}</span>
              )}
            </div>
            <button
              type="button"
              className="map-drawer-close"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Tutup panel filter"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mobile Filter Controls (< lg) */}
          <div className="map-drawer-filters-mobile lg:hidden glass-card">
            <label className="drawer-filter-label">
              <span>PILIH KLASTER</span>
              <select
                value={clusterFilter}
                onChange={(e) => setClusterFilter(e.target.value)}
              >
                <option value="all">Semua klaster</option>
                {clusters.map((id) => (
                  <option key={id} value={id}>Klaster {id}</option>
                ))}
              </select>
            </label>
            <div className="drawer-filter-actions">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={noiseOnly}
                  onChange={(e) => setNoiseOnly(e.target.checked)}
                />
                <span>Hanya Noise (−1)</span>
              </label>
              <button
                type="button"
                className="icon-button"
                onClick={() => { setClusterFilter('all'); setNoiseOnly(false); }}
                aria-label="Reset filter"
                title="Reset filter"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Parameter Cards */}
          <div className="glass-card map-side-card">
            <span className="eyebrow">PARAMETER HASIL AKTIF</span>
            <div className="run-id">#{metadata.data.run.id}</div>
            <div className="run-meta">
              <span>EPSILON</span><strong>{formatNumber(metadata.data.run.eps_km, 2)} km</strong>
              <span>JUMLAH MINIMUM TITIK (MinPts)</span><strong>{metadata.data.run.min_samples}</strong>
              <span>METRIK JARAK</span><strong>{metadata.data.run.metric}</strong>
            </div>
            <p className="map-parameter-note">Parameter diambil dari hasil DBSCAN yang sedang dipublikasikan.</p>
          </div>

          <div className="glass-card map-side-card">
            <span className="eyebrow">PANDUAN PETA</span>
            <h3>Posisi dan kelompok</h3>
            <p>Satu marker mewakili satu kejadian gempa. Warna membantu membedakan ID klaster; jendela informasi menampilkan atribut kejadian dari dataset.</p>
            <div className="map-layer-stat"><LocateFixed size={17} /><span>Koordinat: latitude / longitude</span></div>
            <div className="map-layer-stat"><Filter size={17} /><span>Saring berdasarkan klaster atau Noise</span></div>
          </div>
        </aside>
      </div>
      <div className="map-bottom-note"><Info size={16} /><p><strong>Perlu diingat:</strong> klaster menggambarkan kedekatan/kepadatan spasial menurut parameter yang digunakan. Peta ini bukan peta intensitas guncangan, peta potensi tsunami, atau peta tingkat risiko bencana.</p></div>
    </>}
  </div>;
}
