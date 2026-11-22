import { Activity, ArrowRight, Database, FileClock, Layers3, ShieldCheck, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDatasets } from '../../api/services';
import { PageHeader, SimulationTag, StatePanel, StatCard, StatusBadge, formatDate, formatNumber } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { IS_PREVIEW_MODE } from '../../config/env';

export function DashboardPage() {
  const datasets = useResource(getDatasets, []);
  const list = datasets.data || [];
  const totalRows = list.reduce((sum, item) => sum + item.cleaned_row_count, 0);
  const rejectedRows = list.reduce((sum, item) => sum + item.rejected_row_count, 0);
  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / RINGKASAN" title="Dasbor" description="Ringkasan pengelolaan penelitian DBSCAN." action={<SimulationTag />} />
    {datasets.loading ? <StatePanel type="loading" title="Memuat dasbor" message="Mengambil daftar dataset." /> : datasets.error ? <StatePanel type="error" title="Dasbor belum terhubung" message={datasets.error} action={<button className="button button-secondary" onClick={datasets.reload}>Coba lagi</button>} /> : <>
      <div className="stats-grid"><StatCard label="Dataset tersimpan" value={formatNumber(list.length)} icon={<Database size={18} />} /><StatCard label="Baris bersih" value={formatNumber(totalRows)} icon={<Waves size={18} />} tone="violet" /><StatCard label="Baris ditolak" value={formatNumber(rejectedRows)} icon={<ShieldCheck size={18} />} tone="amber" /><StatCard label="Mode aplikasi" value={IS_PREVIEW_MODE ? 'Pratinjau' : 'Terhubung' } icon={<Activity size={18} />} tone="teal" trend={IS_PREVIEW_MODE ? 'Fitur perubahan data dinonaktifkan' : 'Layanan dataset tersedia'} /></div>
      <div className="dashboard-grid"><section className="glass-card"><div className="card-heading"><div><h3>Dataset terbaru</h3><p>Daftar dataset penelitian yang tersimpan.</p></div><Link to="/admin/dataset" className="inline-link">Lihat semua <ArrowRight size={14} /></Link></div>{list.length ? <div className="dataset-mini-list">{list.slice(0, 4).map((item) => <div className="dataset-mini-row" key={item.id}><span className="dataset-mini-icon"><Database size={16} /></span><div className="dataset-mini-info"><strong>{item.dataset_name}</strong><small>#{item.id} · {formatDate(item.created_at)}</small></div><StatusBadge status={item.status} /></div>)}</div> : <StatePanel type="empty" title="Belum ada dataset" message="Unggah dataset CSV yang telah dibersihkan dari Jupyter Notebook." />}</section>
        <section className="glass-card workflow-card"><div className="card-heading"><div><h3>Alur Kerja Penelitian</h3><p>Tahapan pengelolaan hasil DBSCAN.</p></div><span className="workflow-icon"><Layers3 size={18} /></span></div><div className="workflow-steps"><div><i>01</i><span><strong>Dataset</strong><small>Unggah CSV bersih</small></span><Link to="/admin/dataset">Buka</Link></div><div><i>02</i><span><strong>Pencarian parameter</strong><small>Eksperimen kandidat ε dan MinPts</small></span><Link to="/admin/parameter">Buka</Link></div><div><i>03</i><span><strong>DBSCAN Final</strong><small>Jalankan eksperimen terpilih</small></span><Link to="/admin/dbscan-final">Buka</Link></div><div><i>04</i><span><strong>Riwayat eksekusi</strong><small>Periksa dan aktifkan hasil yang berhasil</small></span><Link to="/admin/riwayat-run">Buka</Link></div></div></section></div>
      <div className="admin-note"><FileClock size={16} /><span>Catatan aktivitas tersedia pada menu Log Aktivitas. Status proses dapat dipantau setelah Pencarian Parameter atau DBSCAN Final dijalankan.</span></div>
    </>}
  </div>;
}
