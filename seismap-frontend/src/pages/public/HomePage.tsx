import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Crosshair, Database,
  Globe2, Layers3, MapPinned, RadioTower, ShieldCheck, Sparkles, Waves,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicMetadata, getPublicSummary } from '../../api/services';
import { SimulationTag, StatePanel, StatCard, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { formatDatasetYearRange } from '../../utils/presentation';

export function HomePage() {
  const summary = useResource(getPublicSummary, []);
  const metadata = useResource(getPublicMetadata, []);
  const data = summary.data;
  const dataset = metadata.data?.dataset;
  const datasetYearRange = formatDatasetYearRange(dataset);
  const silhouetteSampleSize = data?.silhouette_sample_size ?? metadata.data?.run?.silhouette_sample_size ?? null;

  return <div className="home-page">
    <section className="hero-section">
      <div className="hero-copy">
        <div className="hero-overline"><span className="overline-dot" />PEMETAAN & ANALISIS SPASIAL GEMPA <SimulationTag /></div>
        <h1>Membaca pola<br /><span>gempa Indonesia.</span></h1>
        <p className="hero-description">SEISMAP menyajikan hasil penelitian klasterisasi spasial kejadian gempa bumi di Indonesia. Telusuri sebaran titik, pahami kelompok lokasi yang terbentuk, dan baca karakteristik setiap klaster melalui WebGIS.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/peta-klaster">Jelajahi Peta Klaster <ArrowRight size={16} /></Link><Link className="button button-secondary" to="/analisis">Pahami Analisis <ArrowUpRight size={16} /></Link></div>
        <div className="hero-trust"><span><ShieldCheck size={15} />Hasil penelitian DBSCAN</span><span><Crosshair size={15} />Koordinat · Haversine</span><span><Database size={15} />{datasetYearRange ? `Periode ${datasetYearRange}` : 'Dataset penelitian aktif'}</span></div>
      </div>
      <div className="hero-visual" aria-label="Ilustrasi visual geospasial Indonesia">
        <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="hero-orbit orbit-c" />
        <div className="hero-globe"><div className="globe-grid" /><div className="island island-sumatra" /><div className="island island-java" /><div className="island island-kalimantan" /><div className="island island-sulawesi" /><div className="island island-papua" /><span className="map-ping ping-one" /><span className="map-ping ping-two" /><span className="map-ping ping-three" /></div>
        <div className="floating-coordinate"><small>CAKUPAN PENELITIAN</small><strong>INDONESIA</strong><span>90°–145° BT</span></div>
        <div className="floating-live"><span className="pulse-dot" /><span><strong>Penelitian spasial</strong><small>DBSCAN · Haversine</small></span></div>
      </div>
    </section>

    <section className="public-section intro-strip"><div><span className="section-index">01 / TENTANG PENELITIAN</span><h2>Melihat gempa dari<br /><em>pola ruangnya.</em></h2></div><p>Penelitian ini mengelompokkan kejadian gempa berdasarkan kedekatan koordinat geografis. Hasilnya ditampilkan sebagai kelompok spasial dan titik noise, kemudian diperkaya dengan profil magnitudo, kedalaman, waktu, serta lokasi.</p></section>

    <section className="scope-section">
      <div className="section-heading-row"><div><span className="eyebrow">RUANG LINGKUP</span><h2>Apa yang dicakup penelitian?</h2></div><span className="section-side-note">Batas dan atribut mengikuti rancangan penelitian</span></div>
      <div className="scope-grid">
        <article className="scope-card glass-card"><span className="scope-icon"><CalendarDays size={18} /></span><span className="scope-label">PERIODE DATA</span><strong>{datasetYearRange ?? 'Dataset penelitian aktif'}</strong><p>Rentang waktu dataset penelitian yang dianalisis.</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><MapPinned size={18} /></span><span className="scope-label">CAKUPAN KOORDINAT</span><strong>90°–145° BT</strong><p>Batas longitude penelitian; latitude berada pada −15° sampai 10°.</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><Crosshair size={18} /></span><span className="scope-label">FITUR KLASTERISASI</span><strong>Latitude & Longitude</strong><p>Koordinat menjadi dasar pembentukan klaster spasial.</p></article>
        <article className="scope-card glass-card"><span className="scope-icon"><Layers3 size={18} /></span><span className="scope-label">METRIK JARAK</span><strong>Haversine</strong><p>Mengukur jarak antar-koordinat pada permukaan bumi.</p></article>
      </div>
      <div className="scope-footnote"><CheckCircle2 size={15} /><span>Magnitudo, kedalaman, waktu, dan lokasi digunakan untuk membaca profil kejadian/klaster, bukan sebagai fitur pembentuk klaster DBSCAN.</span></div>
    </section>

    <section className="public-section result-section">
      <div className="section-heading-row"><div><span className="eyebrow">02 / RINGKASAN HASIL</span><h2>Ringkasan Hasil Penelitian</h2><p className="section-description">Angka berikut berasal dari hasil DBSCAN aktif yang dipublikasikan melalui sistem.</p></div><Link className="subtle-link" to="/analisis">Baca cara interpretasi <ArrowUpRight size={14} /></Link></div>
      {summary.loading ? <StatePanel type="loading" title="Memuat ringkasan" message="Mengambil ringkasan penelitian dari sistem." /> : summary.error ? <StatePanel type="error" title="Ringkasan belum tersedia" message={summary.error} /> : data ? <>
        <div className="overview-grid">
          <StatCard label="Titik gempa" value={formatNumber(data.total_points)} icon={<Waves size={18} />} tone="cyan" trend="Observasi pada hasil aktif" />
          <StatCard label="Klaster terbentuk" value={formatNumber(data.cluster_count)} icon={<Layers3 size={18} />} tone="violet" trend="Kelompok spasial DBSCAN" />
          <StatCard label="Titik Noise" value={formatNumber(data.noise_count)} icon={<Crosshair size={18} />} tone="amber" trend={`${formatNumber(data.noise_percentage, 2)}% dari seluruh titik`} />
          <StatCard label="Skor Silhouette" value={data.silhouette_score === null ? '—' : formatNumber(data.silhouette_score, 4)} icon={<Sparkles size={18} />} tone="teal" trend={silhouetteSampleSize != null && silhouetteSampleSize > 0 ? `Sampel ${formatNumber(silhouetteSampleSize)} titik non-noise` : 'Indikator evaluasi klaster'} />
        </div>
        <div className="data-provenance"><Database size={16} /><span><strong>{data.dataset_name}</strong>{dataset?.source_name ? ` · ${dataset.source_name}` : ''}{dataset?.start_date && dataset?.end_date ? ` · ${dataset.start_date} – ${dataset.end_date}` : ''}</span><span className="provenance-note">Sumber: hasil DBSCAN aktif</span></div>
      </> : <StatePanel type="empty" title="Belum ada hasil penelitian aktif" message="Ringkasan akan tersedia setelah hasil DBSCAN berstatus Berhasil dan diaktifkan oleh admin. Tampilan ini tidak menggantinya dengan data BMKG realtime." />}
    </section>

    <section className="public-section workflow-section">
      <div className="section-heading-row"><div><span className="eyebrow">03 / ALUR PENELITIAN</span><h2>Dari dataset hingga peta</h2><p className="section-description">SEISMAP menampilkan hasil dari pipeline penelitian; komputasi dan pengelolaan data dilakukan oleh Jupyter Notebook dan sistem SEISMAP.</p></div></div>
      <div className="research-flow">
        <article className="flow-step"><span className="flow-number">01</span><div className="flow-icon"><Database size={19} /></div><h3>Dataset bersih</h3><p>Data penelitian disiapkan melalui Jupyter Notebook dan diunggah sebagai CSV bersih.</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">02</span><div className="flow-icon"><Crosshair size={19} /></div><h3>Analisis parameter</h3><p>Sistem menjalankan pencarian parameter dan menyimpan hasil eksperimen.</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">03</span><div className="flow-icon"><Layers3 size={19} /></div><h3>Final DBSCAN</h3><p>Klasterisasi final dijalankan berdasarkan eksperimen dan keputusan metodologis.</p></article>
        <div className="flow-connector"><ArrowRight size={17} /></div>
        <article className="flow-step"><span className="flow-number">04</span><div className="flow-icon"><Globe2 size={19} /></div><h3>Publikasi WebGIS</h3><p>Hasil DBSCAN yang berhasil dan diaktifkan menjadi sumber peta dan ringkasan publik.</p></article>
      </div>
    </section>

    <section className="public-section interpretation-section">
      <div className="section-heading-row"><div><span className="eyebrow">04 / PANDUAN MEMBACA</span><h2>Klaster bukan tingkat bahaya</h2><p className="section-description">Label hasil DBSCAN menjelaskan pola kedekatan spasial, bukan peringkat kekuatan atau risiko gempa.</p></div></div>
      <div className="interpretation-grid">
        <article className="interpret-card glass-card"><span className="interpret-symbol cluster-symbol"><Layers3 size={19} /></span><h3>Klaster</h3><p>Kumpulan titik yang memiliki kepadatan dan kedekatan spasial sesuai parameter DBSCAN. Nomor klaster hanya identitas, bukan urutan prioritas.</p></article>
        <article className="interpret-card glass-card"><span className="interpret-symbol noise-symbol"><Crosshair size={19} /></span><h3>Noise (−1)</h3><p>Titik yang tidak memenuhi kriteria untuk menjadi bagian dari klaster berdasarkan parameter yang digunakan. Noise bukan berarti data salah atau gempa tidak penting.</p></article>
        <article className="interpret-card glass-card"><span className="interpret-symbol profile-symbol"><BookOpen size={19} /></span><h3>Profil klaster</h3><p>Magnitudo, kedalaman, rentang waktu, dan lokasi membantu menjelaskan karakter anggota setelah kelompok spasial terbentuk.</p></article>
      </div>
    </section>

    <section className="public-section destination-section">
      <div className="section-heading-row"><div><span className="eyebrow">05 / EKSPLORASI</span><h2>Mulai dari yang ingin dipahami</h2></div></div>
      <div className="feature-grid">
        <Link to="/peta-klaster" className="feature-card feature-map"><div className="feature-card-top"><span className="feature-icon"><Globe2 size={19} /></span><span className="feature-number">01</span></div><div><h3>Peta Klaster</h3><p>Amati persebaran titik, kelompok spasial, dan noise pada wilayah penelitian.</p><span className="feature-link">Jelajahi peta <ArrowUpRight size={15} /></span></div></Link>
        <Link to="/analisis" className="feature-card feature-analysis"><div className="feature-card-top"><span className="feature-icon"><Layers3 size={19} /></span><span className="feature-number">02</span></div><div><h3>Analisis</h3><p>Baca distribusi anggota dan profil magnitudo, kedalaman, serta rentang kejadian.</p><span className="feature-link">Buka analisis <ArrowUpRight size={15} /></span></div></Link>
        <Link to="/gempa-terkini" className="feature-card feature-realtime"><div className="feature-card-top"><span className="feature-icon"><RadioTower size={19} /></span><span className="feature-number">03</span></div><div><h3>Gempa Terkini BMKG</h3><p>Periksa informasi gempa terkini sebagai layanan terpisah dari dataset penelitian.</p><span className="feature-link">Lihat informasi BMKG <ArrowUpRight size={15} /></span></div></Link>
      </div>
    </section>

    <section className="separation-note glass-card"><div className="separation-icon"><RadioTower size={19} /></div><div><span className="eyebrow">DUA SUMBER INFORMASI</span><h3>Penelitian DBSCAN dan informasi BMKG memiliki tujuan berbeda</h3><p>WebGIS penelitian membaca hasil DBSCAN aktif dari sistem. Halaman Gempa Terkini membaca informasi BMKG melalui layanan informasi terkini. Keduanya ditampilkan terpisah dan tidak digabungkan ke dalam dataset atau hasil penelitian.</p></div><Link to="/gempa-terkini" className="subtle-link">Buka informasi terkini <ArrowUpRight size={14} /></Link></section>
  </div>;
}

