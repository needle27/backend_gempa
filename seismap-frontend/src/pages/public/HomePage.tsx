import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Crosshair, Database,
  Globe2, Layers3, MapPinned, RadioTower, ShieldCheck, Sparkles, Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicMetadata, getPublicSummary } from '../../api/services';
import { SimulationTag, StatePanel, StatCard, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import { formatDatasetYearRange } from '../../utils/presentation';

export function HomePage() {
  const { tx } = useI18n();
  const summary = useResource(getPublicSummary, []);
  const metadata = useResource(getPublicMetadata, []);
  const data = summary.data;
  const dataset = metadata.data?.dataset;
  const datasetYearRange = formatDatasetYearRange(dataset);
  const silhouetteSampleSize = data?.silhouette_sample_size ?? metadata.data?.run?.silhouette_sample_size ?? null;

  return <div className="home-page">
    <section className="hero-section">
      <div className="hero-copy">
        <div className="hero-overline"><span className="overline-dot" />{tx('PEMETAAN & ANALISIS SPASIAL GEMPA', 'EARTHQUAKE SPATIAL MAPPING & ANALYSIS')} <SimulationTag /></div>
        <h1>{tx(<>Membaca pola<br /><span>gempa Indonesia.</span></>, <>Reading patterns of<br /><span>Indonesia&apos;s earthquakes.</span></>)}</h1>
        <p className="hero-description">{tx(
          'SEISMAP menyajikan hasil penelitian klasterisasi spasial kejadian gempa bumi di Indonesia. Telusuri sebaran titik, pahami kelompok lokasi yang terbentuk, dan baca karakteristik setiap klaster melalui WebGIS.',
          'SEISMAP presents spatial clustering research on earthquake events across Indonesia. Explore event distributions, examine spatial cluster groups, and inspect cluster profiles through WebGIS.',
        )}</p>
        <div className="hero-actions"><Link className="button button-primary" to="/peta-klaster">{tx('Jelajahi Peta Klaster', 'Explore Cluster Map')} <ArrowRight size={16} /></Link><Link className="button button-secondary" to="/analisis">{tx('Pahami Analisis', 'View Analysis')} <ArrowUpRight size={16} /></Link></div>
        <div className="hero-trust"><span><ShieldCheck size={15} />{tx('Hasil penelitian DBSCAN', 'DBSCAN research output')}</span><span><Crosshair size={15} />{tx('Koordinat · Haversine', 'Coordinates · Haversine')}</span><span><Database size={15} />{datasetYearRange ? tx(`Periode ${datasetYearRange}`, `Period ${datasetYearRange}`) : tx('Dataset penelitian aktif', 'Active research dataset')}</span></div>
      </div>
      <div className="hero-visual" aria-label={tx('Ilustrasi visual geospasial Indonesia', 'Indonesia geospatial illustration')}>
        <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="hero-orbit orbit-c" />
        <div className="hero-globe"><div className="globe-grid" /><div className="island island-sumatra" /><div className="island island-java" /><div className="island island-kalimantan" /><div className="island island-sulawesi" /><div className="island island-papua" /><span className="map-ping ping-one" /><span className="map-ping ping-two" /><span className="map-ping ping-three" /></div>
        <div className="floating-coordinate"><small>{tx('CAKUPAN PENELITIAN', 'RESEARCH COVERAGE')}</small><strong>INDONESIA</strong><span>{tx('90°–145° BT', '90°–145° E')}</span></div>
        <div className="floating-live"><span className="pulse-dot" /><span><strong>{tx('Penelitian spasial', 'Spatial research')}</strong><small>DBSCAN · Haversine</small></span></div>
      </div>
    </section>

    <section className="public-section intro-strip"><div><span className="section-index">{tx('01 / TENTANG PENELITIAN', '01 / ABOUT THE RESEARCH')}</span><h2>{tx(<>Melihat gempa dari<br /><em>pola ruangnya.</em></>, <>Understanding earthquakes by<br /><em>their spatial patterns.</em></>)}</h2></div><p>{tx(
      'Penelitian ini mengelompokkan kejadian gempa berdasarkan kedekatan koordinat geografis. Hasilnya ditampilkan sebagai kelompok spasial dan titik noise, kemudian diperkaya dengan profil magnitudo, kedalaman, waktu, serta lokasi.',
      'This research groups earthquake events based on geographic coordinate proximity. Results are presented as spatial clusters and noise points, enriched with magnitude, depth, temporal span, and dominant location profiles.',
    )}</p></section>

    <section className="scope-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('RUANG LINGKUP', 'RESEARCH SCOPE')}</span><h2>{tx('Apa yang dicakup penelitian?', 'What does the study cover?')}</h2></div><span className="section-side-note">{tx('Batas dan atribut mengikuti rancangan penelitian', 'Boundaries and attributes follow the research design')}</span></div>
      <div className="scope-grid">
        <article className="scope-card glass-card"><span className="scope-icon"><CalendarDays size={18} /></span><span className="scope-label">{tx('PERIODE DATA', 'DATA PERIOD')}</span><strong>{datasetYearRange ?? tx('Dataset penelitian aktif', 'Active research dataset')}</strong><p>{tx('Rentang waktu dataset penelitian yang dianalisis.', 'Time range of the analyzed research dataset.')}</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><MapPinned size={18} /></span><span className="scope-label">{tx('CAKUPAN KOORDINAT', 'COORDINATE BOUNDS')}</span><strong>{tx('90°–145° BT', '90°–145° E')}</strong><p>{tx('Batas longitude penelitian; latitude berada pada −15° sampai 10°.', 'Research longitude bounds; latitude spans from −15° to 10°.')}</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><Crosshair size={18} /></span><span className="scope-label">{tx('FITUR KLASTERISASI', 'CLUSTERING FEATURES')}</span><strong>{tx('Latitude & Longitude', 'Latitude & Longitude')}</strong><p>{tx('Koordinat menjadi dasar pembentukan klaster spasial.', 'Coordinates serve as the sole basis for spatial cluster formation.')}</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><Layers3 size={18} /></span><span className="scope-label">{tx('METRIK JARAK', 'DISTANCE METRIC')}</span><strong>Haversine</strong><p>{tx('Mengukur jarak antar-koordinat pada permukaan bumi.', 'Measures great-circle distances across Earth’s surface.')}</p></article>
      </div>
      <div className="scope-footnote"><CheckCircle2 size={15} /><span>{tx('Magnitudo, kedalaman, waktu, dan lokasi digunakan untuk membaca profil kejadian/klaster, bukan sebagai fitur pembentuk klaster DBSCAN.', 'Magnitude, depth, time, and location are used for post-clustering profiling, not as DBSCAN clustering input features.')}</span></div>
    </section>

    <section className="public-section result-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('02 / RINGKASAN HASIL', '02 / RESULT SUMMARY')}</span><h2>{tx('Ringkasan Hasil Penelitian', 'Research Output Summary')}</h2><p className="section-description">{tx('Angka berikut berasal dari hasil DBSCAN aktif yang dipublikasikan melalui sistem.', 'Figures below come from the active DBSCAN run published via the system.')}</p></div><Link className="subtle-link" to="/analisis">{tx('Baca cara interpretasi', 'How to interpret')} <ArrowUpRight size={14} /></Link></div>
      {summary.loading ? <StatePanel type="loading" title={tx('Memuat ringkasan', 'Loading summary')} message={tx('Mengambil ringkasan penelitian dari sistem.', 'Fetching research summary from the system.')} /> : summary.error ? <StatePanel type="error" title={tx('Ringkasan belum tersedia', 'Summary unavailable')} message={summary.error} /> : data ? <>
        <div className="overview-grid">
          <StatCard label={tx('Titik gempa', 'Earthquake points')} value={formatNumber(data.total_points)} icon={<Waves size={18} />} tone="cyan" trend={tx('Observasi pada hasil aktif', 'Observations in active run')} />
          <StatCard label={tx('Klaster terbentuk', 'Clusters formed')} value={formatNumber(data.cluster_count)} icon={<Layers3 size={18} />} tone="violet" trend={tx('Kelompok spasial DBSCAN', 'DBSCAN spatial groups')} />
          <StatCard label={tx('Titik Noise', 'Noise points')} value={formatNumber(data.noise_count)} icon={<Crosshair size={18} />} tone="amber" trend={tx(`${formatNumber(data.noise_percentage, 2)}% dari seluruh titik`, `${formatNumber(data.noise_percentage, 2)}% of total points`)} />
          <StatCard label={tx('Skor Silhouette', 'Silhouette Score')} value={data.silhouette_score === null ? '—' : formatNumber(data.silhouette_score, 4)} icon={<Sparkles size={18} />} tone="teal" trend={silhouetteSampleSize != null && silhouetteSampleSize > 0 ? tx(`Sampel ${formatNumber(silhouetteSampleSize)} titik non-noise`, `Sample of ${formatNumber(silhouetteSampleSize)} non-noise points`) : tx('Indikator evaluasi klaster', 'Cluster evaluation indicator')} />
        </div>
        <div className="data-provenance"><Database size={16} /><span><strong>{data.dataset_name}</strong>{dataset?.source_name ? ` · ${dataset.source_name}` : ''}{dataset?.start_date && dataset?.end_date ? ` · ${dataset.start_date} – ${dataset.end_date}` : ''}</span><span className="provenance-note">{tx('Sumber: hasil DBSCAN aktif', 'Source: active DBSCAN run')}</span></div>
      </> : <StatePanel type="empty" title={tx('Belum ada hasil penelitian aktif', 'No active research run published')} message={tx('Ringkasan akan tersedia setelah hasil DBSCAN berstatus Berhasil dan diaktifkan oleh admin. Tampilan ini tidak menggantinya dengan data BMKG realtime.', 'The summary will appear once a successful DBSCAN run is activated by an administrator. It is kept separate from live BMKG feeds.')} />}
    </section>

    <section className="public-section workflow-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('03 / ALUR PENELITIAN', '03 / RESEARCH PIPELINE')}</span><h2>{tx('Dari dataset hingga peta', 'From dataset to map')}</h2><p className="section-description">{tx('SEISMAP menampilkan hasil dari pipeline penelitian; komputasi dan pengelolaan data dilakukan oleh Jupyter Notebook dan sistem SEISMAP.', 'SEISMAP presents outputs of the research pipeline; computation and data lifecycle management are executed by the SEISMAP processing backend.')}</p></div></div>
      <div className="research-flow">
        <article className="flow-step"><span className="flow-number">01</span><div className="flow-icon"><Database size={19} /></div><h3>{tx('Dataset bersih', 'Clean dataset')}</h3><p>{tx('Data penelitian disiapkan melalui Jupyter Notebook dan diunggah sebagai CSV bersih.', 'Research data is preprocessed and uploaded as a validated CSV dataset.')}</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">02</span><div className="flow-icon"><Crosshair size={19} /></div><h3>{tx('Analisis parameter', 'Parameter analysis')}</h3><p>{tx('Sistem menjalankan pencarian parameter dan menyimpan hasil eksperimen.', 'The system executes parameter grid searches and stores experiment evaluations.')}</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">03</span><div className="flow-icon"><Layers3 size={19} /></div><h3>{tx('Final DBSCAN', 'Final DBSCAN')}</h3><p>{tx('Klasterisasi final dijalankan berdasarkan eksperimen dan keputusan metodologis.', 'Final clustering runs using the selected valid experiment and methodology rules.')}</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">04</span><div className="flow-icon"><Globe2 size={19} /></div><h3>{tx('Publikasi WebGIS', 'WebGIS Publication')}</h3><p>{tx('Hasil DBSCAN yang berhasil dan diaktifkan menjadi sumber peta dan ringkasan publik.', 'The activated DBSCAN run serves as the official source for public maps and summaries.')}</p></article>
      </div>
    </section>

    <section className="public-section interpretation-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('04 / PANDUAN MEMBACA', '04 / INTERPRETATION GUIDE')}</span><h2>{tx('Klaster bukan tingkat bahaya', 'Clusters are not hazard levels')}</h2><p className="section-description">{tx('Label hasil DBSCAN menjelaskan pola kedekatan spasial, bukan peringkat kekuatan atau risiko gempa.', 'DBSCAN cluster labels describe spatial proximity density, not seismic severity or hazard ranking.')}</p></div></div>
      <div className="interpretation-grid">
        <article className="interpret-card glass-card"><span className="interpret-symbol cluster-symbol"><Layers3 size={19} /></span><h3>{tx('Klaster', 'Cluster')}</h3><p>{tx('Kumpulan titik yang memiliki kepadatan dan kedekatan spasial sesuai parameter DBSCAN. Nomor klaster hanya identitas, bukan urutan prioritas.', 'A dense group of spatially close points under DBSCAN parameters. Cluster numbers are nominal identifiers, not priority rankings.')}</p></article>
        <article className="interpret-card glass-card"><span className="interpret-symbol noise-symbol"><Crosshair size={19} /></span><h3>Noise (−1)</h3><p>{tx('Titik yang tidak memenuhi kriteria untuk menjadi bagian dari klaster berdasarkan parameter yang digunakan. Noise bukan berarti data salah atau gempa tidak penting.', 'Points that do not meet density criteria to join any cluster under current parameters. Noise does not imply erroneous or unimportant earthquakes.')}</p></article>
        <article className="interpret-card glass-card"><span className="interpret-symbol profile-symbol"><BookOpen size={19} /></span><h3>{tx('Profil klaster', 'Cluster profile')}</h3><p>{tx('Magnitudo, kedalaman, rentang waktu, dan lokasi membantu menjelaskan karakter anggota setelah kelompok spasial terbentuk.', 'Magnitude, depth, time span, and dominant location characterize cluster members after spatial grouping completes.')}</p></article>
      </div>
    </section>

    <section className="public-section destination-section">
      <div className="section-heading-row"><div><span className="eyebrow">{tx('05 / EKSPLORASI', '05 / EXPLORE')}</span><h2>{tx('Mulai dari yang ingin dipahami', 'Start where you want to explore')}</h2></div></div>
      <div className="feature-grid">
        <Link to="/peta-klaster" className="feature-card feature-map"><div className="feature-card-top"><span className="feature-icon"><Globe2 size={19} /></span><span className="feature-number">01</span></div><div><h3>{tx('Peta Klaster', 'Cluster Map')}</h3><p>{tx('Amati persebaran titik, kelompok spasial, dan noise pada wilayah penelitian.', 'Inspect event distributions, spatial clusters, and noise across the study area.')}</p><span className="feature-link">{tx('Jelajahi peta', 'Explore map')} <ArrowUpRight size={15} /></span></div></Link>
        <Link to="/analisis" className="feature-card feature-analysis"><div className="feature-card-top"><span className="feature-icon"><Layers3 size={19} /></span><span className="feature-number">02</span></div><div><h3>{tx('Analisis', 'Analysis')}</h3><p>{tx('Baca distribusi anggota dan profil magnitudo, kedalaman, serta rentang kejadian.', 'Review member distributions along with magnitude, depth, and temporal profiles.')}</p><span className="feature-link">{tx('Buka analisis', 'Open analysis')} <ArrowUpRight size={15} /></span></div></Link>
        <Link to="/gempa-terkini" className="feature-card feature-realtime"><div className="feature-card-top"><span className="feature-icon"><RadioTower size={19} /></span><span className="feature-number">03</span></div><div><h3>{tx('Gempa Terkini BMKG', 'Latest BMKG Earthquakes')}</h3><p>{tx('Periksa informasi gempa terkini sebagai layanan terpisah dari dataset penelitian.', 'Check live BMKG earthquake updates as a separate feed from the research dataset.')}</p><span className="feature-link">{tx('Lihat informasi BMKG', 'View BMKG updates')} <ArrowUpRight size={15} /></span></div></Link>
      </div>
    </section>

    <section className="separation-note glass-card"><div className="separation-icon"><RadioTower size={19} /></div><div><span className="eyebrow">{tx('DUA SUMBER INFORMASI', 'TWO DISTINCT SOURCES')}</span><h3>{tx('Penelitian DBSCAN dan informasi BMKG memiliki tujuan berbeda', 'DBSCAN research and BMKG updates serve different purposes')}</h3><p>{tx('WebGIS penelitian membaca hasil DBSCAN aktif dari sistem. Halaman Gempa Terkini membaca informasi BMKG melalui layanan informasi terkini. Keduanya ditampilkan terpisah dan tidak digabungkan ke dalam dataset atau hasil penelitian.', 'The research WebGIS reads the active DBSCAN run from the system, while Latest Earthquakes fetches live BMKG alerts. Both remain strictly separated and never merged.')}</p></div><Link to="/gempa-terkini" className="subtle-link">{tx('Buka informasi terkini', 'Open latest updates')} <ArrowUpRight size={14} /></Link></section>
  </div>;
}
