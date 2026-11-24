import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Compass, Crosshair, Filter, Info, LocateFixed, MapPinned, RefreshCw, X } from 'lucide-react';
import { getPublicMetadata, getPublicSummary, getResearchEarthquakes } from '../../api/services';
import { ClusterMap } from '../../components/ClusterMap';
import { PageHeader, SimulationTag, StatePanel, formatNumber } from '../../components/ui';
import { useI18n } from '../../i18n/LanguageContext';
import { formatDatasetYearRange, statusLabel } from '../../utils/presentation';
import { clusterColor, NOISE_COLOR } from '../../utils/clusterColors';
import {
  buildMapCacheKey,
  getMemoryCachedMapDataset,
  markDatasetValidated,
  persistMapDataset,
  readPersistedMapDataset,
  shouldRevalidateCachedDataset,
} from '../../utils/mapDataCache';
import type { PublicMetadata, PublicSummary, ResearchEarthquake } from '../../types/domain';

const MAP_API_PAGE_SIZE = 5000;
const MAP_API_CONCURRENCY = 2;

type MapLoadState = {
  metadata: PublicMetadata | null;
  summary: PublicSummary | null;
  points: ResearchEarthquake[] | null;
  loading: boolean;
  progress: number | null;
  error: string | null;
};

async function getAllResearchEarthquakes(
  totalPoints: number,
  onProgress?: (progressPercent: number) => void,
): Promise<ResearchEarthquake[]> {
  const totalPages = Math.max(1, Math.ceil(totalPoints / MAP_API_PAGE_SIZE));
  const pageResults: ResearchEarthquake[][] = Array.from({ length: totalPages }, () => []);
  let nextPageIndex = 0;
  let completedPages = 0;

  onProgress?.(10);

  async function worker(): Promise<void> {
    while (nextPageIndex < totalPages) {
      const currentIndex = nextPageIndex++;
      pageResults[currentIndex] = await getResearchEarthquakes(currentIndex + 1, MAP_API_PAGE_SIZE);
      completedPages += 1;
      const pct = 10 + Math.round((completedPages / totalPages) * 88);
      onProgress?.(Math.min(98, pct));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAP_API_CONCURRENCY, totalPages) }, () => worker()),
  );
  onProgress?.(100);
  return pageResults.flat();
}

export function ClusterMapPage() {
  const { lang, tx } = useI18n();
  const [mapState, setMapState] = useState<MapLoadState>(() => {
    const mem = getMemoryCachedMapDataset();
    if (mem) {
      return {
        metadata: mem.metadata,
        summary: mem.summary,
        points: mem.points,
        loading: false,
        progress: null,
        error: null,
      };
    }
    return {
      metadata: null,
      summary: null,
      points: null,
      loading: true,
      progress: null,
      error: null,
    };
  });
  const [reloadNonce, setReloadNonce] = useState(0);
  const [clusterFilter, setClusterFilter] = useState('all');
  const [noiseOnly, setNoiseOnly] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const forceFetch = reloadNonce > 0;

    async function fetchFreshFromServer(existingCacheKey: string | null) {
      const bypassCache = existingCacheKey === null && forceFetch;
      const [nextMetadata, nextSummary] = await Promise.all([
        getPublicMetadata({ forceRefresh: bypassCache }),
        getPublicSummary({ forceRefresh: bypassCache }),
      ]);
      if (!active) return;

      if (!nextMetadata.run) {
        setMapState({
          metadata: nextMetadata,
          summary: nextSummary,
          points: [],
          loading: false,
          progress: null,
          error: null,
        });
        return;
      }

      const nextKey = nextSummary ? buildMapCacheKey(nextMetadata, nextSummary) : null;
      if (existingCacheKey && nextKey && existingCacheKey === nextKey) {
        markDatasetValidated();
        return;
      }

      const totalPoints = nextSummary?.total_points ?? 0;
      if (!nextSummary || totalPoints <= 0) {
        setMapState({
          metadata: nextMetadata,
          summary: nextSummary,
          points: [],
          loading: false,
          progress: null,
          error: null,
        });
        return;
      }

      setMapState((prev) => ({
        ...prev,
        metadata: nextMetadata,
        summary: nextSummary,
        loading: true,
        progress: 10,
        error: null,
      }));

      const fetchedPoints = await getAllResearchEarthquakes(totalPoints, (progress) => {
        if (active) {
          setMapState((prev) => (prev.loading ? { ...prev, progress } : prev));
        }
      });
      if (!active) return;

      if (nextKey && fetchedPoints.length > 0) {
        void persistMapDataset({
          cacheKey: nextKey,
          runId: nextMetadata.run.id,
          activatedAt: nextMetadata.run.activated_at ?? null,
          totalPoints,
          metadata: nextMetadata,
          summary: nextSummary,
          points: fetchedPoints,
        });
      }

      setMapState({
        metadata: nextMetadata,
        summary: nextSummary,
        points: fetchedPoints,
        loading: false,
        progress: null,
        error: null,
      });
    }

    async function load() {
      try {
        if (!forceFetch) {
          const mem = getMemoryCachedMapDataset();
          if (mem) {
            if (!shouldRevalidateCachedDataset()) {
              return;
            }
            try {
              await fetchFreshFromServer(mem.cacheKey);
            } catch {
              // Pertahankan data cache aktif bila validasi latar belakang gagal sementara.
            }
            return;
          }

          const persisted = await readPersistedMapDataset();
          if (!active) return;
          if (persisted) {
            setMapState({
              metadata: persisted.metadata,
              summary: persisted.summary,
              points: persisted.points,
              loading: false,
              progress: null,
              error: null,
            });
            try {
              await fetchFreshFromServer(persisted.cacheKey);
            } catch {
              // Pertahankan data tersimpan di browser bila pemeriksaan ringan gagal sementara.
            }
            return;
          }
        }

        setMapState((prev) => ({
          ...prev,
          loading: true,
          progress: 5,
          error: null,
        }));
        await fetchFreshFromServer(null);
      } catch (reason) {
        if (!active) return;
        setMapState((prev) => ({
          ...prev,
          loading: false,
          progress: null,
          error: reason instanceof Error ? reason.message : tx('Data peta belum dapat diambil dari server.', 'Map data could not be loaded from the server.'),
        }));
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [reloadNonce]);

  const { metadata, summary, points } = mapState;

  const filtered = useMemo(() => (points || []).filter((point) => {
    if (noiseOnly && !point.is_noise && point.cluster_id !== -1) return false;
    if (clusterFilter !== 'all' && String(point.cluster_id) !== clusterFilter) return false;
    return true;
  }), [points, clusterFilter, noiseOnly]);

  const clusters = useMemo(
    () => [...new Set((points || []).filter((p) => p.cluster_id !== -1).map((p) => p.cluster_id))].sort((a, b) => a - b),
    [points],
  );

  const activeFilterCount = clusterFilter !== 'all' || noiseOnly ? 1 : 0;
  const datasetYearRange = formatDatasetYearRange(metadata?.dataset);

  const handleClusterFilterChange = (value: string) => {
    setClusterFilter(value);
    if (value !== 'all') {
      setNoiseOnly(false);
    }
  };

  const handleNoiseOnlyChange = (checked: boolean) => {
    setNoiseOnly(checked);
    if (checked) {
      setClusterFilter('all');
    }
  };

  const resetFilters = () => {
    setClusterFilter('all');
    setNoiseOnly(false);
  };

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
    <PageHeader eyebrow={tx('WEBGIS PUBLIK / KLASTER SPASIAL', 'PUBLIC WEBGIS / SPATIAL CLUSTERS')} title={tx('Peta Klaster', 'Cluster Map')} description={tx('Jelajahi lokasi kejadian gempa dan hasil pengelompokan spasial DBSCAN pada cakupan wilayah penelitian Indonesia.', 'Explore earthquake event locations and DBSCAN spatial clustering outputs across the Indonesian research study area.')} action={<SimulationTag />} />

    <section className="map-explainer glass-card">
      <div className="map-explainer-heading"><span className="map-explainer-icon"><MapPinned size={20} /></span><div><span className="eyebrow">{tx('PANDUAN PETA', 'MAP GUIDE')}</span><h2>{tx('Setiap titik punya konteks spasial', 'Every point has spatial context')}</h2><p>{tx('Peta menampilkan kejadian dari dataset penelitian pada hasil DBSCAN aktif. Pilih klaster untuk memusatkan perhatian atau tampilkan Noise secara terpisah.', 'The map renders earthquake events from the active DBSCAN run. Filter by a specific cluster or inspect Noise points separately.')}</p></div></div>
      <div className="map-explainer-grid">
        <article><span className="map-key cluster-key" /><div><strong>{tx('Anggota klaster', 'Cluster member')}</strong><p>{tx('Warna marker membedakan kelompok. Nomor ID klaster adalah label identitas, bukan urutan atau tingkat bahaya.', 'Marker colors distinguish groups. Cluster IDs are nominal identifiers, not rankings or hazard levels.')}</p></div></article>
        <article><span className="map-key noise-key" /><div><strong>Noise (−1)</strong><p>{tx('Titik yang tidak masuk ke kelompok berdasarkan kombinasi parameter DBSCAN pada hasil tersebut.', 'Points that did not meet density thresholds to join any cluster under current DBSCAN parameters.')}</p></div></article>
        <article><span className="map-key coordinate-key"><Crosshair size={14} /></span><div><strong>{tx('Posisi kejadian', 'Event position')}</strong><p>{tx('Marker ditempatkan berdasarkan latitude dan longitude dari data penelitian.', 'Markers are plotted by event latitude and longitude from the research dataset.')}</p></div></article>
      </div>
    </section>

    <div className="map-scope-strip"><span><Compass size={15} />{tx('METODE: DBSCAN · HAVERSINE', 'METHOD: DBSCAN · HAVERSINE')}</span><span><MapPinned size={15} />{tx('CAKUPAN: LAT −15° s.d. 10° · LON 90° s.d. 145°', 'BOUNDS: LAT −15° to 10° · LON 90° to 145°')}</span><span><Info size={15} />{tx('SUMBER:', 'SOURCE:')} {datasetYearRange ? tx(`DATASET PENELITIAN ${datasetYearRange}`, `RESEARCH DATASET ${datasetYearRange}`) : tx('DATASET PENELITIAN AKTIF', 'ACTIVE RESEARCH DATASET')}</span></div>

    {mapState.loading ? (
      <StatePanel
        type="loading"
        title={tx('Memuat Peta Klasterisasi', 'Loading Cluster Map')}
        message={tx('Menyiapkan data spasial kejadian gempa dari server penelitian.', 'Preparing earthquake spatial records from the research server.')}
        progress={mapState.progress}
      />
    ) : mapState.error ? (
      <StatePanel
        type="error"
        title={tx('Peta belum dapat ditampilkan', 'Unable to load map')}
        message={mapState.error}
        action={
          <button type="button" className="button button-secondary" onClick={() => setReloadNonce((n) => n + 1)}>
            <RefreshCw size={15} /> {tx('Coba lagi', 'Try again')}
          </button>
        }
      />
    ) : !metadata?.run ? (
      <StatePanel
        type="empty"
        title={tx('Belum ada hasil penelitian yang dipublikasikan', 'No published research run yet')}
        message={tx('Peta akan menampilkan titik dan label klaster setelah admin mengaktifkan hasil DBSCAN berstatus Berhasil. Informasi gempa terkini BMKG tidak digunakan sebagai pengganti dataset penelitian.', 'The map will display points and cluster labels once an administrator activates a successful DBSCAN run. Live BMKG earthquake feeds are kept separate from the research dataset.')}
      />
    ) : <>
      {summary && <div className="map-run-summary"><div><span>{tx('JUMLAH TITIK', 'TOTAL POINTS')}</span><strong>{formatNumber(summary.total_points)}</strong></div><div><span>{tx('JUMLAH KLASTER', 'CLUSTER COUNT')}</span><strong>{formatNumber(summary.cluster_count)}</strong></div><div><span>{tx('TITIK NOISE', 'NOISE POINTS')}</span><strong>{formatNumber(summary.noise_count)} <small>({formatNumber(summary.noise_percentage, 2)}%)</small></strong></div></div>}

      {/* Desktop Toolbar (>= lg) */}
      <div className="map-toolbar glass-card"><div className="map-toolbar-title"><span className="live-indicator" /><div><strong>{tx('Peta penelitian Indonesia', 'Indonesia research map')}</strong><small>{tx('Hasil', 'Run')} #{metadata.run.id} · {metadata.run.metric} · {tx('status', 'status')} {statusLabel(metadata.run.status, lang)}</small></div></div><div className="map-filters"><label><Filter size={14} /><select value={clusterFilter} onChange={(e) => handleClusterFilterChange(e.target.value)}><option value="all">{tx('Semua klaster', 'All clusters')}</option>{clusters.map((id) => <option key={id} value={id}>{tx('Klaster', 'Cluster')} {id}</option>)}</select></label><label className="toggle-label"><input type="checkbox" checked={noiseOnly} onChange={(e) => handleNoiseOnlyChange(e.target.checked)} /> {tx('Hanya Noise', 'Noise Only')}</label><button className="icon-button" onClick={resetFilters} aria-label={tx('Reset filter', 'Reset filter')}><RefreshCw size={15} /></button></div></div>

      {/* Mobile Action Bar (< lg): sejajar rapi di atas peta, tidak menutupi konten */}
      <div className="map-mobile-bar glass-card lg:hidden">
        <div className="map-mobile-bar-info">
          <span className="live-indicator" />
          <div>
            <strong>{tx('Hasil', 'Run')} #{metadata.run.id}</strong>
            <small>
              {noiseOnly
                ? tx('Filter aktif: Hanya Noise (−1)', 'Active filter: Noise Only (−1)')
                : clusterFilter !== 'all'
                  ? tx(`Filter aktif: Klaster ${clusterFilter}`, `Active filter: Cluster ${clusterFilter}`)
                  : `${formatNumber(points?.length ?? 0)} ${tx('titik aktif', 'active points')}`}
            </small>
          </div>
        </div>
        <div className="map-mobile-bar-actions">
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="icon-button"
              onClick={resetFilters}
              aria-label={tx('Reset filter', 'Reset filter')}
              title={tx('Reset filter', 'Reset filter')}
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="map-mobile-filter-btn"
            aria-label={tx('Buka filter peta', 'Open map filters')}
          >
            <Filter size={15} />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

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
          <div className="map-stage">
            <ClusterMap points={filtered} className="h-[100dvh]" />
            {points && filtered.length === 0 && (
              <div className="map-empty-overlay" role="status" aria-live="polite">
                <div className="map-empty-card glass-card">
                  <Crosshair size={20} />
                  <strong>{tx('Tidak ada titik gempa untuk filter saat ini', 'No earthquake points match the current filter')}</strong>
                  <p>
                    {noiseOnly
                      ? tx('Tidak terdapat titik noise (−1) pada hasil klasterisasi aktif atau filter terlalu ketat.', 'No noise (−1) points exist in the active run or the filter is too restrictive.')
                      : tx('Kombinasi filter yang dipilih menghasilkan 0 kejadian gempa.', 'The selected filter combination returned 0 earthquake events.')}
                  </p>
                  {activeFilterCount > 0 && (
                    <button type="button" className="button button-secondary" onClick={resetFilters}>
                      <RefreshCw size={14} /> {tx('Reset Filter', 'Reset Filter')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="map-legend-panel">
            <button
              type="button"
              className="map-legend-toggle lg:hidden"
              onClick={() => setIsLegendOpen((prev) => !prev)}
              aria-expanded={isLegendOpen}
              aria-controls="cluster-map-legend"
            >
              <span>
                <strong>{tx('Legenda Peta', 'Map Legend')}</strong>
                <small>{formatNumber(clusters.length)} {tx('klaster', 'clusters')} + Noise (−1)</small>
              </span>
              <ChevronDown size={16} className={isLegendOpen ? 'rotated' : ''} />
            </button>
            <div id="cluster-map-legend" className={`map-legend${isLegendOpen ? ' is-open' : ''}`}>
              {clusters.slice(0, 8).map((clusterId) => (
                <span key={clusterId}>
                  <i className="legend-dot" style={{ backgroundColor: clusterColor(clusterId) }} />
                  {tx('Klaster', 'Cluster')} {clusterId}
                </span>
              ))}
              {clusters.length > 8 && (
                <span className="legend-more">+{formatNumber(clusters.length - 8)} {tx('klaster lainnya', 'more clusters')}</span>
              )}
              <span>
                <i className="legend-dot" style={{ backgroundColor: NOISE_COLOR }} />
                Noise (−1)
              </span>
            </div>
          </div>
          <div className="map-all-points-note">
            {activeFilterCount > 0
              ? tx(`Menampilkan ${formatNumber(filtered.length)} dari ${formatNumber(points?.length ?? 0)} titik gempa sesuai filter.`, `Showing ${formatNumber(filtered.length)} of ${formatNumber(points?.length ?? 0)} earthquake points matching filter.`)
              : tx(`Menampilkan seluruh ${formatNumber(points?.length ?? 0)} titik gempa pada hasil aktif.`, `Showing all ${formatNumber(points?.length ?? 0)} earthquake points in the active run.`)}
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
              <span>{tx('Filter & Parameter', 'Filter & Parameters')}</span>
              {activeFilterCount > 0 && (
                <span className="filter-badge">{activeFilterCount}</span>
              )}
            </div>
            <button
              type="button"
              className="map-drawer-close"
              onClick={() => setIsDrawerOpen(false)}
              aria-label={tx('Tutup panel filter', 'Close filter panel')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Mobile Filter Controls (< lg) */}
          <div className="map-drawer-filters-mobile lg:hidden glass-card">
            <label className="drawer-filter-label">
              <span>{tx('PILIH KLASTER', 'SELECT CLUSTER')}</span>
              <select
                value={clusterFilter}
                onChange={(e) => handleClusterFilterChange(e.target.value)}
              >
                <option value="all">{tx('Semua klaster', 'All clusters')}</option>
                {clusters.map((id) => (
                  <option key={id} value={id}>{tx('Klaster', 'Cluster')} {id}</option>
                ))}
              </select>
            </label>
            <div className="drawer-filter-actions">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={noiseOnly}
                  onChange={(e) => handleNoiseOnlyChange(e.target.checked)}
                />
                <span>{tx('Hanya Noise (−1)', 'Noise Only (−1)')}</span>
              </label>
              <button
                type="button"
                className="icon-button"
                onClick={resetFilters}
                aria-label={tx('Reset filter', 'Reset filter')}
                title={tx('Reset filter', 'Reset filter')}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Parameter Cards */}
          <div className="glass-card map-side-card">
            <span className="eyebrow">{tx('PARAMETER HASIL AKTIF', 'ACTIVE RUN PARAMETERS')}</span>
            <div className="run-id">#{metadata.run.id}</div>
            <div className="run-meta">
              <span>EPSILON</span><strong>{formatNumber(metadata.run.eps_km, 2)} km</strong>
              <span>{tx('JUMLAH MINIMUM TITIK (MinPts)', 'MINIMUM POINTS (MinPts)')}</span><strong>{metadata.run.min_samples}</strong>
              <span>{tx('METRIK JARAK', 'DISTANCE METRIC')}</span><strong>{metadata.run.metric}</strong>
            </div>
            <p className="map-parameter-note">{tx('Parameter diambil dari hasil DBSCAN yang sedang dipublikasikan.', 'Parameters reflect the currently published DBSCAN run.')}</p>
          </div>

          <div className="glass-card map-side-card">
            <span className="eyebrow">{tx('PANDUAN PETA', 'MAP GUIDE')}</span>
            <h3>{tx('Posisi dan kelompok', 'Location and grouping')}</h3>
            <p>{tx('Satu marker mewakili satu kejadian gempa. Warna membantu membedakan ID klaster; jendela informasi menampilkan atribut kejadian dari dataset.', 'Each marker represents one earthquake event. Colors distinguish cluster IDs; popups display event attributes from the dataset.')}</p>
            <div className="map-layer-stat"><LocateFixed size={17} /><span>{tx('Koordinat: latitude / longitude', 'Coordinates: latitude / longitude')}</span></div>
            <div className="map-layer-stat"><Filter size={17} /><span>{tx('Saring berdasarkan klaster atau Noise', 'Filter by cluster or Noise')}</span></div>
          </div>
        </aside>
      </div>
      <div className="map-bottom-note"><Info size={16} /><p><strong>{tx('Perlu diingat:', 'Note:')}</strong> {tx('klaster menggambarkan kedekatan/kepadatan spasial menurut parameter yang digunakan. Peta ini bukan peta intensitas guncangan, peta potensi tsunami, atau peta tingkat risiko bencana.', 'Clusters indicate spatial density under selected parameters. This map does not represent shaking intensity, tsunami risk, or hazard alerts.')}</p></div>
    </>}
  </div>;
}
