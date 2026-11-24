import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Clock3, ExternalLink, MapPin, RadioTower, RefreshCw } from 'lucide-react';
import { getPublicMetadata, getRealtimeFeed } from '../../api/services';
import { PageHeader, SimulationTag, StatePanel, GlassCard, formatDate, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import type { RealtimeEarthquake, RealtimeFeed } from '../../types/domain';
import { formatDatasetYearRange, statusLabel } from '../../utils/presentation';
import { RealtimeEarthquakeMap } from '../../components/RealtimeEarthquakeMap';

type FeedTab = 'latest' | 'm5' | 'felt';

export function RealtimePage() {
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
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : 'Informasi BMKG belum dapat diambil.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [tab]);

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
    <PageHeader eyebrow="INFORMASI GEMPA / BMKG" title="Gempa Terkini" description="Informasi kejadian gempa dari BMKG sebagai pelengkap aplikasi, terpisah dari dataset penelitian DBSCAN." action={<SimulationTag />} />
    <div className="realtime-source glass-card"><div className="source-icon"><RadioTower size={19} /></div><div><strong>Sumber data: BMKG</strong><span>Badan Meteorologi, Klimatologi, dan Geofisika · informasi publik yang diakses melalui sistem SEISMAP</span></div><a href="https://data.bmkg.go.id/gempabumi/" target="_blank" rel="noreferrer">Portal resmi <ExternalLink size={13} /></a></div>
    <section className="realtime-category-section" aria-label="Pilih kategori gempa">
      <div className="realtime-category-heading">
        <div>
          <span className="eyebrow">JELAJAHI INFORMASI</span>
          <h2>Informasi gempa</h2>
          <p>Pilih kategori untuk melihat kejadian sesuai kebutuhan.</p>
        </div>
        <span className="realtime-category-source"><i /> Data BMKG</span>
      </div>
      <div className="feed-tabs realtime-category-tabs" role="tablist" aria-label="Kategori gempa">
        {([
          { id: 'latest', label: 'Gempa terbaru', description: 'Kejadian paling baru' },
          { id: 'm5', label: 'Magnitudo 5.0+', description: 'Gempa bermagnitudo 5 ke atas' },
          { id: 'felt', label: 'Gempa dirasakan', description: 'Kejadian dengan laporan dirasakan' },
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
    {loading && !feed ? <StatePanel type="loading" title="Memuat informasi gempa" message="Mengambil informasi gempa terkini." /> : error && !feed ? <StatePanel type="error" title="Informasi gempa belum tersedia" message={error} action={<button className="button button-secondary" onClick={() => { setCountdown(300); void load(); }}><RefreshCw size={14} /> Coba lagi</button>} /> : !feed || items.length === 0 ? <StatePanel type="empty" title="Tidak ada data pada kategori ini" message="Belum ada kejadian pada kategori yang dipilih." /> : <>
      {feed.is_stale && <div className="stale-warning"><AlertTriangle size={17} /><div><strong>Data tersimpan sementara</strong><span>{feed.warning || 'Informasi yang ditampilkan berasal dari penyimpanan sementara dan mungkin belum merupakan pembaruan terbaru.'}</span></div></div>}
      <div className={`realtime-content-layout ${tab === 'latest' ? 'is-latest' : 'is-list'}`} id="realtime-feed-content">
        <div className="realtime-content-primary">
          {error && <div className="realtime-inline-error" role="status">Pembaruan gagal: {error}. Data terakhir tetap ditampilkan.</div>}
          {tab === 'latest' && feed.earthquake
            ? <LatestEarthquake item={feed.earthquake} />
            : <div className="realtime-list-panel glass-card">
                <div className="realtime-list-heading">
                  <div><h3>{tab === 'm5' ? 'Gempa magnitudo 5.0+' : 'Gempa dirasakan'}</h3><p>{items.length} kejadian tersedia dari informasi BMKG</p></div>
                  <span>{items.length} kejadian</span>
                </div>
                <div className="realtime-table-wrap"><table className="realtime-table"><thead><tr><th>Magnitudo</th><th>Lokasi</th><th>Waktu kejadian</th><th>Kedalaman</th><th>Koordinat</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.event_time_utc || item.date_local}-${index}`}><td><span className="table-magnitude">{formatNumber(item.magnitude, 1)}</span></td><td className="table-location">{item.region || 'Lokasi tidak tersedia'}</td><td>{item.date_local || '—'}<small>{item.time_local || '—'}</small></td><td>{item.depth_label || (item.depth_km === null ? '—' : `${item.depth_km} km`)}</td><td>{item.latitude_label || formatNumber(item.latitude, 2)}, {item.longitude_label || formatNumber(item.longitude, 2)}</td></tr>)}</tbody></table></div>
              </div>}
          <div className="feed-meta">
            <span><Clock3 size={13} /> Diperbarui: {formatDate(feed.fetched_at)}</span>
            <span>Status: {statusLabel(feed.cache_status)}</span>
            <span className="realtime-refresh-countdown" title="Pembaruan otomatis setiap 5 menit">
              <RefreshCw size={11} /> Otomatis dalam <strong>{String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}</strong>
            </span>
            <button className="text-button" onClick={() => { setCountdown(300); void load(); }} disabled={loading}><RefreshCw size={13} /> Perbarui sekarang</button>
          </div>
        </div>
        <aside className="realtime-content-map">
          <RealtimeEarthquakeMap items={items} highlightLatest={tab === 'latest'} />
        </aside>
      </div>
    </>}
    <div className="realtime-separation-note glass-card"><BookOpen size={17} /><div><strong>Terpisah dari penelitian DBSCAN</strong><p>Informasi BMKG ini merupakan informasi pelengkap yang diperbarui melalui layanan informasi terkini. Data di halaman ini tidak digabungkan ke {datasetYearRange ? `dataset penelitian ${datasetYearRange}` : 'dataset penelitian aktif'}, tidak membentuk klaster, dan tidak digunakan dalam hasil analisis penelitian.</p></div></div>
    <div className="realtime-disclaimer"><AlertTriangle size={15} /><span>Informasi ini merupakan pelengkap, bukan pengganti arahan keselamatan. Untuk informasi resmi keselamatan dan peringatan tsunami, ikuti kanal resmi BMKG.</span></div>
  </div>;
}

function LatestEarthquake({ item }: { item: RealtimeEarthquake }) {
  return (
    <div className="latest-earthquake-grid">
      <GlassCard className="latest-magnitude">
        <span className="eyebrow">GEMPA TERBARU</span>
        <div className="magnitude-number">{formatNumber(item.magnitude, 1)}<small> M</small></div>
        <h3>{item.region || 'Lokasi tidak tersedia'}</h3>
        <p><Clock3 size={14} /> {item.date_local || '—'} · {item.time_local || 'Waktu tidak tersedia'}</p>
        <div className="latest-coordinates">
          <span><MapPin size={14} /> {item.latitude_label || formatNumber(item.latitude, 2)}</span>
          <span>{item.longitude_label || formatNumber(item.longitude, 2)}</span>
        </div>
      </GlassCard>

      <GlassCard
        className="latest-details"
        title="Detail kejadian"
        subtitle="Informasi sesuai data BMKG"
        action={<span className="status-badge status-success"><i /> SUMBER BMKG</span>}
      >
        <div className="detail-grid">
          <Detail label="Kedalaman" value={item.depth_label || (item.depth_km === null ? '—' : `${item.depth_km} km`)} />
          <Detail label="Potensi tsunami" value={item.tsunami_potential || 'Tidak tersedia'} />
          <Detail label="Dirasakan" value={item.felt || 'Tidak tersedia'} />
          <Detail label="Koordinat" value={`${formatNumber(item.latitude, 2)}, ${formatNumber(item.longitude, 2)}`} />
        </div>
        {item.shakemap_url && (
          <a className="shakemap-link" href={item.shakemap_url} target="_blank" rel="noreferrer">
            Lihat peta guncangan <ExternalLink size={13} />
          </a>
        )}
      </GlassCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>; }

