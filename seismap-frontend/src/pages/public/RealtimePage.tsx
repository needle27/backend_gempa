import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Clock3, ExternalLink, MapPin, RadioTower, RefreshCw } from 'lucide-react';
import { getPublicMetadata, getRealtimeFeed } from '../../api/services';
import { PageHeader, SimulationTag, StatePanel, GlassCard, formatDate, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import type { RealtimeEarthquake, RealtimeFeed } from '../../types/domain';
import { formatDatasetYearRange, statusLabel } from '../../utils/presentation';
import { RealtimeEarthquakeMap } from '../../components/RealtimeEarthquakeMap';

type FeedTab = 'latest' | 'm5' | 'felt';

export function RealtimePage() {
  const { lang, tx } = useI18n();
  const metadata = useResource(getPublicMetadata, []);
  const datasetYearRange = formatDatasetYearRange(metadata.data?.dataset);
  const [tab, setTab] = useState<FeedTab>('latest');
  const [feed, setFeed] = useState<RealtimeFeed<RealtimeEarthquake> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300);
  const requestVersion = useRef(0);
  const feedCache = useRef<Partial<Record<FeedTab, RealtimeFeed<RealtimeEarthquake>>>>({});
  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet && !feedCache.current[tab]) setLoading(true);
    try {
      const result = await getRealtimeFeed(tab);
      if (version === requestVersion.current) {
        feedCache.current[tab] = result;
        setFeed(result);
        setError(null);
      }
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : tx('Informasi BMKG belum dapat diambil.', 'Failed to fetch BMKG feed.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [tab, tx]);

  useEffect(() => {
    requestVersion.current += 1;
    setFeed(feedCache.current[tab] || null);
    setError(null);
    setLoading(!feedCache.current[tab]);
    setCountdown(300);
    void load(Boolean(feedCache.current[tab]));

    // Hitung mundur dan minta data baru setiap 5 menit selama halaman aktif.
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setCountdown((remaining) => {
        return remaining <= 1 ? 0 : remaining - 1;
      });
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setCountdown(300);
        void load(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  useEffect(() => {
    if (countdown === 0) {
      void load(true);
      setCountdown(300);
    }
  }, [countdown, load]);

  const items = feed?.earthquakes || (feed?.earthquake ? [feed.earthquake] : []);
  return <div className="page-stack">
    <PageHeader eyebrow={tx('INFORMASI GEMPA / BMKG', 'EARTHQUAKE FEED / BMKG')} title={tx('Gempa Terkini', 'Latest Earthquakes')} description={tx('Informasi kejadian gempa dari BMKG sebagai pelengkap aplikasi, terpisah dari dataset penelitian DBSCAN.', 'Live BMKG earthquake information complementing the application, kept separate from the DBSCAN research dataset.')} action={<SimulationTag />} />
    <div className="realtime-source glass-card"><div className="source-icon"><RadioTower size={19} /></div><div><strong>{tx('Sumber data: BMKG', 'Data source: BMKG')}</strong><span>{tx('Badan Meteorologi, Klimatologi, dan Geofisika · informasi publik yang diakses melalui sistem SEISMAP', 'Indonesian Agency for Meteorology, Climatology, and Geophysics · public feed accessed via SEISMAP')}</span></div><a href="https://data.bmkg.go.id/gempabumi/" target="_blank" rel="noreferrer">{tx('Portal resmi', 'Official portal')} <ExternalLink size={13} /></a></div>
    <section className="realtime-category-section" aria-label={tx('Pilih kategori gempa', 'Select earthquake category')}>
      <div className="realtime-category-heading">
        <div>
          <span className="eyebrow">{tx('JELAJAHI INFORMASI', 'EXPLORE FEED')}</span>
          <h2>{tx('Informasi gempa', 'Earthquake updates')}</h2>
          <p>{tx('Pilih kategori untuk melihat kejadian sesuai kebutuhan.', 'Select a category to view relevant earthquake events.')}</p>
        </div>
        <span className="realtime-category-source"><i /> {tx('Data BMKG', 'BMKG Data')}</span>
      </div>
      <div className="feed-tabs realtime-category-tabs" role="tablist" aria-label={tx('Kategori gempa', 'Earthquake categories')}>
        {([
          { id: 'latest', label: tx('Gempa terbaru', 'Latest event'), description: tx('Kejadian paling baru', 'Most recent event') },
          { id: 'm5', label: tx('Magnitudo 5.0+', 'Magnitude 5.0+'), description: tx('Gempa bermagnitudo 5 ke atas', 'Events with magnitude ≥ 5.0') },
          { id: 'felt', label: tx('Gempa dirasakan', 'Felt earthquakes'), description: tx('Kejadian dengan laporan dirasakan', 'Events with felt intensity reports') },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="realtime-feed-content"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </section>
    {loading && !feed ? <StatePanel type="loading" title={tx('Memuat informasi gempa', 'Loading earthquake feed')} message={tx('Mengambil informasi gempa terkini.', 'Fetching latest earthquake updates.')} /> : error && !feed ? <StatePanel type="error" title={tx('Informasi gempa belum tersedia', 'Earthquake feed unavailable')} message={error} action={<button className="button button-secondary" onClick={() => { setCountdown(300); void load(); }}><RefreshCw size={14} /> {tx('Coba lagi', 'Try again')}</button>} /> : !feed || items.length === 0 ? <StatePanel type="empty" title={tx('Tidak ada data pada kategori ini', 'No events in this category')} message={tx('Belum ada kejadian pada kategori yang dipilih.', 'No events found for the selected category.')} /> : <>
      {feed.is_stale && <div className="stale-warning"><AlertTriangle size={17} /><div><strong>{tx('Data tersimpan sementara', 'Temporarily cached data')}</strong><span>{feed.warning || tx('Informasi yang ditampilkan berasal dari penyimpanan sementara dan mungkin belum merupakan pembaruan terbaru.', 'Displayed information comes from temporary cache and may not reflect the latest update.')}</span></div></div>}
      <div className={`realtime-content-layout ${tab === 'latest' ? 'is-latest' : 'is-list'}`} id="realtime-feed-content">
        <div className="realtime-content-primary">
          {error && <div className="realtime-inline-error" role="status">{tx(`Pembaruan gagal: ${error}. Data terakhir tetap ditampilkan.`, `Refresh failed: ${error}. Showing last available data.`)}</div>}
          {tab === 'latest' && feed.earthquake
            ? <LatestEarthquake item={feed.earthquake} />
            : <div className="realtime-list-panel glass-card">
                <div className="realtime-list-heading">
                  <div><h3>{tab === 'm5' ? tx('Gempa magnitudo 5.0+', 'Magnitude 5.0+ earthquakes') : tx('Gempa dirasakan', 'Felt earthquakes')}</h3><p>{tx(`${items.length} kejadian tersedia dari informasi BMKG`, `${items.length} events available from BMKG`)}</p></div>
                  <span>{items.length} {tx('kejadian', 'events')}</span>
                </div>
                <div className="realtime-table-wrap"><table className="realtime-table"><thead><tr><th>{tx('Magnitudo', 'Magnitude')}</th><th>{tx('Lokasi', 'Location')}</th><th>{tx('Waktu kejadian', 'Event time')}</th><th>{tx('Kedalaman', 'Depth')}</th><th>{tx('Koordinat', 'Coordinates')}</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.event_time_utc || item.date_local}-${index}`}><td><span className="table-magnitude">{formatNumber(item.magnitude, 1)}</span></td><td className="table-location">{item.region || tx('Lokasi tidak tersedia', 'Location unavailable')}</td><td>{item.date_local || '—'}<small>{item.time_local || '—'}</small></td><td>{item.depth_label || (item.depth_km === null ? '—' : `${item.depth_km} km`)}</td><td>{item.latitude_label || formatNumber(item.latitude, 2)}, {item.longitude_label || formatNumber(item.longitude, 2)}</td></tr>)}</tbody></table></div>
              </div>}
          <div className="feed-meta">
            <span><Clock3 size={13} /> {tx('Diperbarui:', 'Updated:')} {formatDate(feed.fetched_at)}</span>
            <span>Status: {statusLabel(feed.cache_status, lang)}</span>
            <span className="realtime-refresh-countdown" title={tx('Pembaruan otomatis setiap 5 menit', 'Auto-refresh every 5 minutes')}>
              <RefreshCw size={11} /> {tx('Otomatis dalam', 'Auto in')} <strong>{String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}</strong>
            </span>
            <button className="text-button" onClick={() => { setCountdown(300); void load(); }} disabled={loading}><RefreshCw size={13} /> {tx('Perbarui sekarang', 'Refresh now')}</button>
          </div>
        </div>
        <aside className="realtime-content-map">
          <RealtimeEarthquakeMap items={items} highlightLatest={tab === 'latest'} />
        </aside>
      </div>
    </>}
    <div className="realtime-separation-note glass-card"><BookOpen size={17} /><div><strong>{tx('Terpisah dari penelitian DBSCAN', 'Separate from DBSCAN research')}</strong><p>{tx(
      `Informasi BMKG ini merupakan informasi pelengkap yang diperbarui melalui layanan informasi terkini. Data di halaman ini tidak digabungkan ke ${datasetYearRange ? `dataset penelitian ${datasetYearRange}` : 'dataset penelitian aktif'}, tidak membentuk klaster, dan tidak digunakan dalam hasil analisis penelitian.`,
      `This BMKG feed serves as complementary real-time information. Events here are not merged into the ${datasetYearRange ? `${datasetYearRange} research dataset` : 'active research dataset'}, do not form clusters, and do not affect research analysis results.`,
    )}</p></div></div>
    <div className="realtime-disclaimer"><AlertTriangle size={15} /><span>{tx('Informasi ini merupakan pelengkap, bukan pengganti arahan keselamatan. Untuk informasi resmi keselamatan dan peringatan tsunami, ikuti kanal resmi BMKG.', 'This feed is supplemental and does not replace official safety advisories. Follow official BMKG channels for safety and tsunami warnings.')}</span></div>
  </div>;
}

function LatestEarthquake({ item }: { item: RealtimeEarthquake }) {
  const { tx } = useI18n();
  return (
    <div className="latest-earthquake-grid">
      <GlassCard className="latest-magnitude">
        <span className="eyebrow">{tx('GEMPA TERBARU', 'LATEST EARTHQUAKE')}</span>
        <div className="magnitude-number">{formatNumber(item.magnitude, 1)}<small> M</small></div>
        <h3>{item.region || tx('Lokasi tidak tersedia', 'Location unavailable')}</h3>
        <p><Clock3 size={14} /> {item.date_local || '—'} · {item.time_local || tx('Waktu tidak tersedia', 'Time unavailable')}</p>
        <div className="latest-coordinates">
          <span><MapPin size={14} /> {item.latitude_label || formatNumber(item.latitude, 2)}</span>
          <span>{item.longitude_label || formatNumber(item.longitude, 2)}</span>
        </div>
      </GlassCard>

      <GlassCard
        className="latest-details"
        title={tx('Detail kejadian', 'Event details')}
        subtitle={tx('Informasi sesuai data BMKG', 'Information as reported by BMKG')}
        action={<span className="status-badge status-success"><i /> {tx('SUMBER BMKG', 'BMKG SOURCE')}</span>}
      >
        <div className="detail-grid">
          <Detail label={tx('Kedalaman', 'Depth')} value={item.depth_label || (item.depth_km === null ? '—' : `${item.depth_km} km`)} />
          <Detail label={tx('Potensi tsunami', 'Tsunami potential')} value={item.tsunami_potential || tx('Tidak tersedia', 'Unavailable')} />
          <Detail label={tx('Dirasakan', 'Felt report')} value={item.felt || tx('Tidak tersedia', 'Unavailable')} />
          <Detail label={tx('Koordinat', 'Coordinates')} value={`${formatNumber(item.latitude, 2)}, ${formatNumber(item.longitude, 2)}`} />
        </div>
        {item.shakemap_url && (
          <a className="shakemap-link" href={item.shakemap_url} target="_blank" rel="noreferrer">
            {tx('Lihat peta guncangan', 'View shakemap')} <ExternalLink size={13} />
          </a>
        )}
      </GlassCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>; }
