import { useState, type FormEvent } from 'react';
import { CheckCircle2, CloudUpload, Database, RefreshCw, Trash2, Upload } from 'lucide-react';
import { getDatasetDetail, getDatasets, uploadDataset } from '../../api/services';
import { usePipeline } from '../../context/PipelineContext';
import { IS_PREVIEW_MODE } from '../../config/env';
import { GlassCard, PageHeader, PrimaryButton, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { useResource } from '../../hooks/useResource';
import { useI18n } from '../../i18n/LanguageContext';
import type { DatasetItem, UploadResult } from '../../types/domain';

export function DatasetPage() {
  const { tx } = useI18n();
  const datasets = useResource(getDatasets, []);
  const { setSelectedDatasetId } = usePipeline();
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [preprocessingVersion, setPreprocessingVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailDatasetId, setDetailDatasetId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetItem | null>(null);

  const showDetail = async (datasetId: number) => {
    setDetailDatasetId(datasetId); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getDatasetDetail(datasetId)); }
    catch (reason) { setDetailError(reason instanceof Error ? reason.message : tx('Rincian dataset tidak dapat dimuat.', 'Unable to load dataset details.')); }
    finally { setDetailLoading(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try { const uploaded = await uploadDataset({ file, datasetName, sourceName, sourceUrl, preprocessingVersion }); setResult(uploaded); setSelectedDatasetId(uploaded.dataset_id); datasets.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : tx('Dataset gagal diunggah.', 'Failed to upload dataset.')); }
    finally { setBusy(false); }
  };

  const handleConfirmDelete = () => {
    if (!datasetToDelete) return;
    setError(tx(
      `Dataset "${datasetToDelete.dataset_name}" (#${datasetToDelete.id}) berstatus permanen (immutable) dan dilindungi sistem untuk menjaga integritas riwayat penelitian & audit log.`,
      `Dataset "${datasetToDelete.dataset_name}" (#${datasetToDelete.id}) is immutable and system-protected to preserve research reproducibility and audit logs.`,
    ));
    setDatasetToDelete(null);
  };

  return <div className="page-stack">
    <PageHeader eyebrow={tx('ADMIN / PENGELOLAAN DATA', 'ADMIN / DATA MANAGEMENT')} title="Dataset" description={tx('Kelola dataset penelitian yang telah diproses dan siap digunakan.', 'Manage preprocessed research datasets ready for analysis.')} action={<SimulationTag />} />
    <div className="dataset-layout"><GlassCard title={tx('Unggah Dataset Bersih', 'Upload Clean Dataset')} subtitle={tx('Unggah file CSV hasil prapemrosesan.', 'Upload a preprocessed CSV file.')}><form className="stack-form" onSubmit={submit}>
      <label>{tx('Nama Dataset', 'Dataset Name')}<input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder={tx('Gempa Indonesia 2021–2025', 'Indonesia Earthquakes 2021–2025')} required disabled={IS_PREVIEW_MODE} /></label>
      <label>{tx('Sumber Dataset', 'Dataset Source')}<input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder={tx('BMKG / katalog gempa', 'BMKG / earthquake catalog')} required disabled={IS_PREVIEW_MODE} /></label>
      <div className="form-row"><label>{tx('Tautan Sumber', 'Source URL')} <small>{tx('(opsional)', '(optional)')}</small><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" disabled={IS_PREVIEW_MODE} /></label><label>{tx('Versi Prapemrosesan', 'Preprocessing Version')} <small>{tx('(opsional)', '(optional)')}</small><input value={preprocessingVersion} onChange={(e) => setPreprocessingVersion(e.target.value)} placeholder="v1.0" disabled={IS_PREVIEW_MODE} /></label></div>
      <label className={`file-drop ${file ? 'file-selected' : ''}`}><input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={IS_PREVIEW_MODE} /><span className="file-drop-icon"><CloudUpload size={23} /></span><strong>{file?.name || tx('Pilih file CSV', 'Choose CSV file')}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : tx('Klik untuk memilih atau tarik file ke area ini', 'Click to browse or drag and drop file here')}</small></label>
      {IS_PREVIEW_MODE && <div className="inline-notice"><span className="notice-dot" />{tx('Pengunggahan dinonaktifkan pada Mode Pratinjau. Tidak ada data yang dikirim.', 'Uploads are disabled in Preview Mode. No data is transmitted.')}</div>}
      {error && <div className="form-error">{error}</div>}
      {result && <div className="success-panel"><CheckCircle2 size={18} /><div><strong>{tx('Pengunggahan berhasil dikonfirmasi', 'Upload confirmed')}</strong><span>Dataset #{result.dataset_id} · {formatNumber(result.cleaned_row_count)} {tx('baris bersih', 'clean rows')}</span><StatusBadge status={result.status} /></div></div>}
      <PrimaryButton type="submit" disabled={IS_PREVIEW_MODE || busy || !file || !datasetName || !sourceName}>{busy ? tx('Mengunggah…', 'Uploading…') : <><Upload size={15} /> {tx('Unggah Dataset', 'Upload Dataset')}</>}</PrimaryButton>
    </form></GlassCard>
    <GlassCard title={tx('Ketentuan File', 'File Requirements')}>
      <ul className="requirement-list">
        <li><CheckCircle2 size={15} /><span><strong>{tx('Periode & Wilayah:', 'Period & Bounds:')}</strong> {tx('2021–2025, latitude -15 s.d. 10, longitude 90 s.d. 145.', '2021–2025, latitude -15 to 10, longitude 90 to 145.')}</span></li>
        <li><CheckCircle2 size={15} /><span><strong>{tx('Format Waktu:', 'Timestamp Format:')}</strong> {tx('ISO-8601 lengkap dengan zona waktu/offset.', 'Full ISO-8601 with timezone/offset.')}</span></li>
        <li><CheckCircle2 size={15} /><span><strong>{tx('Nilai Numerik:', 'Numeric Rules:')}</strong> <code>event_id</code> {tx('unik', 'unique')}; <code>magnitude</code> ≥ 0; <code>kedalaman</code> {tx('boleh kosong (jika terisi ≥ 0)', 'optional (if present ≥ 0)')}; <code>lokasi</code> {tx('boleh kosong.', 'optional.')}</span></li>
        <li><CheckCircle2 size={15} /><span><strong>{tx('Kolom Wajib:', 'Required Columns:')}</strong> <code>event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</code>.</span></li>
      </ul>
      <div className="code-field">event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</div>
      <p className="subtle-copy">{tx('File ditolak jika ada baris tidak valid; sistem tidak mengubah data otomatis.', 'Files are rejected if any invalid rows exist; the system does not alter rows automatically.')}</p>
    </GlassCard></div>
    <GlassCard title={tx('Dataset Terdaftar', 'Registered Datasets')} action={<button className="icon-button" onClick={datasets.reload} aria-label={tx('Muat ulang', 'Reload')}><RefreshCw size={15} /></button>}>
      {datasets.loading ? <StatePanel type="loading" title={tx('Memuat dataset', 'Loading datasets')} message={tx('Mengambil data dataset.', 'Fetching dataset records.')} /> : datasets.error ? <StatePanel type="error" title={tx('Data dataset belum tersedia', 'Datasets unavailable')} message={datasets.error} /> : !datasets.data?.length ? <StatePanel type="empty" title={tx('Belum ada dataset', 'No datasets yet')} message={tx('Dataset yang berhasil diunggah akan ditampilkan di sini.', 'Successfully uploaded datasets will appear here.')} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Dataset</th><th>{tx('Periode', 'Period')}</th><th>{tx('Baris awal', 'Raw rows')}</th><th>{tx('Baris bersih', 'Clean rows')}</th><th>{tx('Ditolak', 'Rejected')}</th><th>Status</th><th>{tx('Tanggal dibuat', 'Created at')}</th><th /></tr></thead><tbody>{datasets.data.map((item) => <tr key={item.id}><td><strong>{item.dataset_name}</strong><small className="table-sub">{item.source_name} · #{item.id}</small></td><td>{item.start_date} — {item.end_date}</td><td>{formatNumber(item.raw_row_count)}</td><td>{formatNumber(item.cleaned_row_count)}</td><td>{formatNumber(item.rejected_row_count)}</td><td><StatusBadge status={item.status} /></td><td>{formatDate(item.created_at)}</td><td><div className="table-actions"><button className="text-button" onClick={() => setSelectedDatasetId(item.id)}><Database size={13} /> {tx('Pilih', 'Select')}</button><button className="text-button" onClick={() => void showDetail(item.id)}>{tx('Rincian', 'Details')}</button><button className="text-button" style={{ color: 'var(--danger, #fb7185)' }} onClick={() => setDatasetToDelete(item)}><Trash2 size={13} /> {tx('Hapus', 'Delete')}</button></div></td></tr>)}</tbody></table></div>}
    </GlassCard>
    {detailDatasetId !== null && <GlassCard title={tx(`Rincian dataset #${detailDatasetId}`, `Dataset #${detailDatasetId} Details`)} subtitle={tx('Informasi dataset yang dipilih.', 'Details for the selected dataset.')} action={<button className="icon-button" onClick={() => { setDetailDatasetId(null); setDetail(null); }} aria-label={tx('Tutup rincian', 'Close details')}>×</button>}>{detailLoading ? <StatePanel type="loading" title={tx('Memuat rincian', 'Loading details')} message={tx('Mengambil informasi dataset.', 'Fetching dataset information.')} /> : detailError ? <StatePanel type="error" title={tx('Rincian tidak tersedia', 'Details unavailable')} message={detailError} /> : <RecordDetails record={detail || {}} />}</GlassCard>}

    <ConfirmModal
      isOpen={Boolean(datasetToDelete)}
      variant="danger"
      title={tx('Konfirmasi Hapus Dataset', 'Confirm Dataset Deletion')}
      icon={<Trash2 size={22} />}
      confirmLabel={tx('Ya, Hapus Dataset', 'Yes, Delete Dataset')}
      cancelLabel={tx('Batal', 'Cancel')}
      onCancel={() => setDatasetToDelete(null)}
      onConfirm={handleConfirmDelete}
      message={
        datasetToDelete ? (
          <div>
            <p>
              {tx(
                <>Apakah Anda yakin ingin menghapus dataset <strong>"{datasetToDelete.dataset_name}"</strong> (#{datasetToDelete.id})?</>,
                <>Are you sure you want to delete dataset <strong>"{datasetToDelete.dataset_name}"</strong> (#{datasetToDelete.id})?</>,
              )}
            </p>
            <p style={{ marginTop: '8px', color: '#fca5a5', fontSize: '12px' }}>
              {tx('Catatan: Dataset yang sudah terdaftar menjadi acuan bagi proses Pencarian Parameter dan DBSCAN Final.', 'Note: Registered datasets serve as permanent references for Parameter Search and Final DBSCAN runs.')}
            </p>
          </div>
        ) : null
      }
    />
  </div>;
}
