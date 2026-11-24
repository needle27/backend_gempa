import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardList, Filter, RefreshCw, Search } from 'lucide-react';
import { getAuditLogs, type AuditLogFilters } from '../../api/services';
import { GlassCard, PageHeader, SimulationTag, StatePanel, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import type { AuditLogRecord } from '../../types/domain';
import { actionLabel, displayValue } from '../../utils/presentation';

const PAGE_SIZE = 50;

function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function DetailValue({ record }: { record: AuditLogRecord }) {
  const { tx } = useI18n();
  const details = record.details;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return <details className="audit-detail"><summary>{tx('Lihat rincian', 'View details')}</summary><RecordDetails record={details as Record<string, unknown>} /></details>;
  }
  if (typeof details === 'string' && details.trim()) {
    try {
      const parsed: unknown = JSON.parse(details);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return <details className="audit-detail"><summary>{tx('Lihat rincian', 'View details')}</summary><RecordDetails record={parsed as Record<string, unknown>} /></details>;
      if (Array.isArray(parsed)) return <span className="muted-text">{parsed.length} {tx('rincian tersedia', 'details available')}</span>;
    } catch { /* The detail is ordinary text, not a structured record. */ }
    return <details className="audit-detail"><summary>{tx('Lihat rincian', 'View details')}</summary><p>{details}</p></details>;
  }
  return <span className="muted-text">{tx('Tidak ada rincian', 'No details')}</span>;
}

export function AuditLogPage() {
  const { lang, tx } = useI18n();
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
      setFormError(tx('ID objek dan ID pengguna harus berupa angka bulat positif.', 'Entity ID and User ID must be positive integers.')); return;
    }
    const after = localDateTimeToIso(draft.created_after);
    const before = localDateTimeToIso(draft.created_before);
    if (after && before && new Date(after).getTime() > new Date(before).getTime()) {
      setFormError(tx('Waktu awal tidak boleh melewati waktu akhir.', 'Start time must not exceed end time.')); return;
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
    <PageHeader eyebrow={tx('ADMIN / KEAMANAN & JEJAK AKTIVITAS', 'ADMIN / SECURITY & AUDIT TRAIL')} title={tx('Log Aktivitas', 'Activity Logs')} description={tx('Riwayat aktivitas pengguna dan sistem secara permanen.', 'Permanent record of administrator and system activities.')} action={<SimulationTag />} />

    <GlassCard
      className="audit-filter-card"
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> {tx('Filter Aktivitas', 'Filter Activity')}</span>}
      action={<button className="button button-secondary" type="button" onClick={clearFilters}>{tx('Reset Filter', 'Reset Filter')}</button>}
    >
      <form className="audit-filter-grid" onSubmit={applyFilters}>
        <label className="audit-filter-wide">{tx('Cari Aktivitas', 'Search Activity')}<input maxLength={120} value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder={tx('Tindakan, jenis objek, nama pengguna, atau email', 'Action, entity type, username, or email')} /></label>
        <label>{tx('Tindakan', 'Action')}<select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}><option value="">{tx('Semua tindakan', 'All actions')}</option><option value="ADMIN_LOGIN">{tx('Admin masuk', 'Admin Login')}</option><option value="ADMIN_LOGOUT">{tx('Admin keluar', 'Admin Logout')}</option><option value="DATASET_UPLOAD">{tx('Unggah Dataset', 'Upload Dataset')}</option><option value="DATASET_VALIDATE">{tx('Validasi Dataset', 'Validate Dataset')}</option><option value="PARAMETER_SEARCH">{tx('Pencarian Parameter', 'Parameter Search')}</option><option value="FINAL_CLUSTERING">{tx('Klasterisasi Final', 'Final Clustering')}</option><option value="RUN_ACTIVATE">{tx('Aktifkan hasil', 'Activate Run')}</option></select></label>
        <label>{tx('Jenis objek', 'Entity Type')}<select value={draft.entity_type} onChange={(event) => setDraft({ ...draft, entity_type: event.target.value })}><option value="">{tx('Semua objek', 'All entities')}</option><option value="dataset">Dataset</option><option value="run">{tx('Eksekusi', 'Run')}</option><option value="user">{tx('Pengguna', 'User')}</option></select></label>
        <label>{tx('ID objek', 'Entity ID')}<input inputMode="numeric" value={draft.entity_id} onChange={(event) => setDraft({ ...draft, entity_id: event.target.value })} placeholder={tx('Contoh: 20', 'Example: 20')} /></label>
        <label>{tx('ID pengguna', 'User ID')}<input inputMode="numeric" value={draft.user_id} onChange={(event) => setDraft({ ...draft, user_id: event.target.value })} placeholder={tx('Masukkan ID pengguna', 'Enter user ID')} /></label>
        <label>{tx('Dari Tanggal', 'From Date')}<input type="datetime-local" value={draft.created_after} onChange={(event) => setDraft({ ...draft, created_after: event.target.value })} /></label>
        <label>{tx('Sampai Tanggal', 'To Date')}<input type="datetime-local" value={draft.created_before} onChange={(event) => setDraft({ ...draft, created_before: event.target.value })} /></label>
        {formError && <div className="form-error audit-filter-wide">{formError}</div>}
        <div className="audit-filter-actions audit-filter-wide"><button className="button button-primary" type="submit"><Search size={15} /> {tx('Terapkan filter', 'Apply filter')}</button><button className="button button-secondary" type="button" onClick={logs.reload}><RefreshCw size={14} /> {tx('Muat ulang', 'Reload')}</button></div>
      </form>
    </GlassCard>

    <GlassCard title={tx('Catatan Aktivitas', 'Activity Records')}>
      {logs.loading ? <StatePanel type="loading" title={tx('Memuat catatan aktivitas', 'Loading activity logs')} message={tx('Mengambil catatan aktivitas.', 'Fetching activity records.')} /> : logs.error ? <StatePanel type="error" title={tx('Catatan aktivitas belum tersedia', 'Activity logs unavailable')} message={logs.error} action={<button className="button button-secondary" onClick={logs.reload}>{tx('Coba lagi', 'Try again')}</button>} /> : !auditData?.items.length ? <div className="audit-empty"><span className="audit-empty-icon"><ClipboardList size={24} /></span><StatePanel type="empty" title={tx('Belum ada catatan aktivitas', 'No activity logs found')} message={tx('Tidak ditemukan aktivitas yang sesuai dengan filter.', 'No records match the current filter criteria.')} /></div> : <>
        <div className="audit-result-meta"><span><strong>{formatNumber(auditData.count)}</strong> {tx('catatan sesuai', 'matching records')}</span><span>{tx('Halaman', 'Page')} {currentPage} {tx('dari', 'of')} {totalPages}</span></div>
        <div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>{tx('Waktu', 'Timestamp')}</th><th>{tx('Tindakan', 'Action')}</th><th>{tx('Pengguna', 'User')}</th><th>{tx('Objek', 'Entity')}</th><th>{tx('Alamat IP', 'IP Address')}</th><th>{tx('Rincian', 'Details')}</th></tr></thead><tbody>{auditData.items.map((record, index) => <tr key={String(record.id ?? `${record.action}-${index}`)}><td><strong>{formatDate(typeof record.created_at === 'string' ? record.created_at : null)}</strong><small className="table-sub">#{displayValue(record.id, '', lang)}</small></td><td><span className="audit-action">{actionLabel(typeof record.action === 'string' ? record.action : null, lang)}</span></td><td>{displayValue(record.username || record.email || record.user_id, 'username', lang)}</td><td>{[displayValue(record.entity_type, 'entity_type', lang), record.entity_id == null ? '' : `#${displayValue(record.entity_id, '', lang)}`].filter(Boolean).join(' ') || '—'}</td><td>{displayValue(record.ip_address, '', lang)}</td><td><DetailValue record={record} /></td></tr>)}</tbody></table></div>
        <div className="audit-pagination"><span>{tx('Menampilkan', 'Showing')} {formatNumber(auditData.offset + 1)}–{formatNumber(auditData.offset + auditData.items.length)} {tx('dari', 'of')} {formatNumber(auditData.count)}</span><div><button className="button button-secondary" disabled={currentPage <= 1 || logs.loading} onClick={() => setQuery({ ...query, page: currentPage - 1 })}>{tx('Sebelumnya', 'Previous')}</button><button className="button button-secondary" disabled={currentPage >= totalPages || logs.loading} onClick={() => setQuery({ ...query, page: currentPage + 1 })}>{tx('Berikutnya', 'Next')}</button></div></div>
      </>}
    </GlassCard>
  </div>;
}
