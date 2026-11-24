import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getAuditLogs, type AuditLogFilters } from '../../api/services';
import { GlassCard, PageHeader, SimulationTag, StatePanel, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import type { AuditLogRecord } from '../../types/domain';
import { actionLabel, displayValue } from '../../utils/presentation';

const PAGE_SIZE = 50;

function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function DetailValue({ record }: { record: AuditLogRecord }) {
  const details = record.details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return <details className="audit-detail"><summary>Lihat rincian</summary><RecordDetails record={details as Record<string, unknown>} /></details>;
  }
  if (typeof details === 'string' && details.trim()) {
    try {
      const parsed: unknown = JSON.parse(details);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return <details className="audit-detail"><summary>Lihat rincian</summary><RecordDetails record={parsed as Record<string, unknown>} /></details>;
      if (Array.isArray(parsed)) return <span className="muted-text">{parsed.length} rincian tersedia</span>;
    } catch { /* The detail is ordinary text, not a structured record. */ }
    return <details className="audit-detail"><summary>Lihat rincian</summary><p>{details}</p></details>;
  }
  return <span className="muted-text">Tidak ada rincian</span>;
}

export function AuditLogPage() {
  const [draft, setDraft] = useState({ q: '', action: '', entity_type: '', entity_id: '', user_id: '', created_after: '', created_before: '' });
  const [query, setQuery] = useState<AuditLogFilters>({ page: 1, limit: PAGE_SIZE });
  const [formError, setFormError] = useState<string | null>(null);
  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  const logs = useResource(() => getAuditLogs(query), [queryKey]);
  const auditData = logs.data;
  const totalPages = Math.max(1, Math.ceil((auditData?.count || 0) / PAGE_SIZE));
  const currentPage = query.page || 1;

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const entityId = draft.entity_id.trim();
    const userId = draft.user_id.trim();
    if ((entityId && (!/^\d+$/.test(entityId) || Number(entityId) < 1)) || (userId && (!/^\d+$/.test(userId) || Number(userId) < 1))) {
      setFormError('ID objek dan ID pengguna harus berupa angka bulat positif.'); return;
    }
    const after = localDateTimeToIso(draft.created_after);
    const before = localDateTimeToIso(draft.created_before);
    if (after && before && new Date(after).getTime() > new Date(before).getTime()) {
      setFormError('Waktu awal tidak boleh melewati waktu akhir.'); return;
    }
    setQuery({
      page: 1,
      limit: PAGE_SIZE,
      q: draft.q.trim().slice(0, 120) || undefined,
      action: draft.action.trim() || undefined,
      entity_type: draft.entity_type.trim() || undefined,
      entity_id: entityId || undefined,
      user_id: userId || undefined,
      created_after: after,
      created_before: before,
    });
  };

  const clearFilters = () => {
    setDraft({ q: '', action: '', entity_type: '', entity_id: '', user_id: '', created_after: '', created_before: '' });
    setFormError(null);
    setQuery({ page: 1, limit: PAGE_SIZE });
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / KEAMANAN & JEJAK AKTIVITAS" title="Log Aktivitas" description="Catatan tindakan yang dilakukan pada aplikasi. Catatan ini hanya dapat dilihat, dengan penyaringan dan pembagian halaman." action={<SimulationTag />} />
    <div className="validation-callout"><ShieldCheck size={18} /><div><strong>Catatan aktivitas bersifat permanen dan tidak dapat diubah melalui aplikasi.</strong><span>Pemeriksaan CSV juga tercatat sebagai aktivitas, meskipun berkas yang diperiksa tidak disimpan sebagai dataset.</span></div></div>

    <GlassCard
      className="audit-filter-card"
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> Filter aktivitas</span>}
      subtitle="Saring catatan berdasarkan kata kunci, tindakan, objek, pengguna, atau waktu."
      action={<button className="button button-secondary" type="button" onClick={clearFilters}>Hapus filter</button>}
    >
      <form className="audit-filter-grid" onSubmit={applyFilters}>
        <label className="audit-filter-wide">Cari aktivitas (maks. 120 karakter)<input maxLength={120} value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="Tindakan, jenis objek, nama pengguna, atau email" /></label>
        <label>Tindakan<select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}><option value="">Semua tindakan</option><option value="ADMIN_LOGIN">Admin masuk</option><option value="ADMIN_LOGOUT">Admin keluar</option><option value="DATASET_UPLOAD">Unggah Dataset</option><option value="DATASET_VALIDATE">Validasi Dataset</option><option value="PARAMETER_SEARCH">Pencarian Parameter</option><option value="FINAL_CLUSTERING">Klasterisasi Final</option><option value="RUN_ACTIVATE">Aktifkan hasil</option></select></label>
        <label>Jenis objek<select value={draft.entity_type} onChange={(event) => setDraft({ ...draft, entity_type: event.target.value })}><option value="">Semua objek</option><option value="dataset">Dataset</option><option value="run">Eksekusi</option><option value="user">Pengguna</option></select></label>
        <label>ID objek<input inputMode="numeric" value={draft.entity_id} onChange={(event) => setDraft({ ...draft, entity_id: event.target.value })} placeholder="Masukkan ID positif" /></label>
        <label>ID pengguna<input inputMode="numeric" value={draft.user_id} onChange={(event) => setDraft({ ...draft, user_id: event.target.value })} placeholder="Masukkan ID pengguna" /></label>
        <label>Sejak waktu<input type="datetime-local" value={draft.created_after} onChange={(event) => setDraft({ ...draft, created_after: event.target.value })} /></label>
        <label>Sampai waktu<input type="datetime-local" value={draft.created_before} onChange={(event) => setDraft({ ...draft, created_before: event.target.value })} /></label>
        {formError && <div className="form-error audit-filter-wide">{formError}</div>}
        <div className="audit-filter-actions audit-filter-wide"><button className="button button-primary" type="submit"><Search size={15} /> Terapkan filter</button><button className="button button-secondary" type="button" onClick={logs.reload}><RefreshCw size={14} /> Muat ulang</button></div>
      </form>
    </GlassCard>

    <GlassCard title="Catatan Aktivitas" subtitle="Jumlah mencakup seluruh catatan yang sesuai dengan filter, bukan hanya catatan pada halaman ini.">
      {logs.loading ? <StatePanel type="loading" title="Memuat catatan aktivitas" message="Mengambil catatan aktivitas." /> : logs.error ? <StatePanel type="error" title="Catatan aktivitas belum tersedia" message={logs.error} action={<button className="button button-secondary" onClick={logs.reload}>Coba lagi</button>} /> : !auditData?.items.length ? <div className="audit-empty"><span className="audit-empty-icon"><ClipboardList size={24} /></span><StatePanel type="empty" title="Belum ada catatan aktivitas" message="Tidak ditemukan aktivitas yang sesuai dengan filter." /></div> : <>
        <div className="audit-result-meta"><span><strong>{formatNumber(auditData.count)}</strong> catatan sesuai</span><span>Halaman {currentPage} dari {totalPages}</span></div>
        <div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>Waktu</th><th>Tindakan</th><th>Pengguna</th><th>Objek</th><th>Alamat IP</th><th>Rincian</th></tr></thead><tbody>{auditData.items.map((record, index) => <tr key={String(record.id ?? `${record.action}-${index}`)}><td><strong>{formatDate(typeof record.created_at === 'string' ? record.created_at : null)}</strong><small className="table-sub">#{displayValue(record.id)}</small></td><td><span className="audit-action">{actionLabel(typeof record.action === 'string' ? record.action : null)}</span></td><td>{displayValue(record.username || record.email || record.user_id, 'username')}</td><td>{[displayValue(record.entity_type, 'entity_type'), record.entity_id == null ? '' : `#${displayValue(record.entity_id)}`].filter(Boolean).join(' ') || '—'}</td><td>{displayValue(record.ip_address)}</td><td><DetailValue record={record} /></td></tr>)}</tbody></table></div>
        <div className="audit-pagination"><span>Menampilkan {formatNumber(auditData.offset + 1)}–{formatNumber(auditData.offset + auditData.items.length)} dari {formatNumber(auditData.count)}</span><div><button className="button button-secondary" disabled={currentPage <= 1 || logs.loading} onClick={() => setQuery({ ...query, page: currentPage - 1 })}>Sebelumnya</button><button className="button button-secondary" disabled={currentPage >= totalPages || logs.loading} onClick={() => setQuery({ ...query, page: currentPage + 1 })}>Berikutnya</button></div></div>
      </>}
    </GlassCard>
  </div>;
}
