import { useState, type FormEvent } from 'react';
import { CheckCircle2, CloudUpload, Database, RefreshCw, Upload } from 'lucide-react';
import { getDatasetDetail, getDatasets, uploadDataset } from '../../api/services';
import { usePipeline } from '../../context/PipelineContext';
import { IS_PREVIEW_MODE } from '../../config/env';
import { GlassCard, PageHeader, PrimaryButton, SimulationTag, StatePanel, StatusBadge, formatDate, formatNumber, RecordDetails } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import type { UploadResult } from '../../types/domain';

export function DatasetPage() {
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

  const showDetail = async (datasetId: number) => {
    setDetailDatasetId(datasetId); setDetail(null); setDetailError(null); setDetailLoading(true);
    try { setDetail(await getDatasetDetail(datasetId)); }
    catch (reason) { setDetailError(reason instanceof Error ? reason.message : 'Rincian dataset tidak dapat dimuat.'); }
    finally { setDetailLoading(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try { const uploaded = await uploadDataset({ file, datasetName, sourceName, sourceUrl, preprocessingVersion }); setResult(uploaded); setSelectedDatasetId(uploaded.dataset_id); datasets.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Dataset gagal diunggah.'); }
    finally { setBusy(false); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / PENGELOLAAN DATA" title="Dataset" description="Kelola dataset penelitian yang telah diproses dan siap digunakan." action={<SimulationTag />} />
    <div className="dataset-layout"><GlassCard title="Unggah Dataset Bersih" subtitle="File harus berasal dari hasil prapemrosesan di Jupyter Notebook."><form className="stack-form" onSubmit={submit}>
      <label>Nama Dataset<input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="Gempa Indonesia 2021–2025" required disabled={IS_PREVIEW_MODE} /></label>
      <label>Sumber Dataset<input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="BMKG / katalog gempa" required disabled={IS_PREVIEW_MODE} /></label>
      <div className="form-row"><label>Tautan sumber <small>(opsional)</small><input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" disabled={IS_PREVIEW_MODE} /></label><label>Versi prapemrosesan <small>(opsional)</small><input value={preprocessingVersion} onChange={(e) => setPreprocessingVersion(e.target.value)} placeholder="v1.0" disabled={IS_PREVIEW_MODE} /></label></div>
      <label className={`file-drop ${file ? 'file-selected' : ''}`}><input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={IS_PREVIEW_MODE} /><span className="file-drop-icon"><CloudUpload size={23} /></span><strong>{file?.name || 'Pilih berkas CSV'}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Klik untuk memilih atau tarik berkas ke area ini'}</small></label>
      {IS_PREVIEW_MODE && <div className="inline-notice"><span className="notice-dot" />Pengunggahan dinonaktifkan pada Mode Pratinjau. Tidak ada data yang dikirim.</div>}
      {error && <div className="form-error">{error}</div>}
      {result && <div className="success-panel"><CheckCircle2 size={18} /><div><strong>Pengunggahan berhasil dikonfirmasi</strong><span>Dataset #{result.dataset_id} · {formatNumber(result.cleaned_row_count)} baris bersih</span><StatusBadge status={result.status} /></div></div>}
      <PrimaryButton type="submit" disabled={IS_PREVIEW_MODE || busy || !file || !datasetName || !sourceName}>{busy ? 'Mengunggah…' : <><Upload size={15} /> Unggah Dataset</>}</PrimaryButton>
    </form></GlassCard>
    <GlassCard title="Ketentuan Berkas" subtitle="Pemeriksaan akhir tetap dilakukan oleh sistem."><ul className="requirement-list"><li><CheckCircle2 size={15} /> CSV hasil prapemrosesan, bukan data mentah.</li><li><CheckCircle2 size={15} /> Periode penelitian 2021–2025.</li><li><CheckCircle2 size={15} /> Latitude -15 s.d. 10; longitude 90 s.d. 145.</li><li><CheckCircle2 size={15} /> Waktu kejadian wajib mencantumkan zona waktu.</li><li><CheckCircle2 size={15} /> ID kejadian harus unik; magnitudo harus berupa angka dan tidak negatif.</li><li><CheckCircle2 size={15} /> Kedalaman boleh kosong; jika terisi harus numerik dan tidak negatif.</li><li><CheckCircle2 size={15} /> Kolom lokasi wajib tersedia, tetapi nilainya boleh kosong.</li></ul><p className="subtle-copy">Nama kolom wajib pada berkas CSV:</p><div className="code-field">event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</div><p className="subtle-copy">Aplikasi tidak menghapus atau memperbaiki baris secara diam-diam. Berkas dapat ditolak seluruhnya jika ditemukan baris yang tidak sesuai.</p></GlassCard></div>
    <GlassCard title="Dataset Terdaftar" subtitle="Daftar dataset yang tersimpan." action={<button className="icon-button" onClick={datasets.reload} aria-label="Muat ulang"><RefreshCw size={15} /></button>}>
      {datasets.loading ? <StatePanel type="loading" title="Memuat dataset" message="Mengambil data dataset." /> : datasets.error ? <StatePanel type="error" title="Data dataset belum tersedia" message={datasets.error} /> : !datasets.data?.length ? <StatePanel type="empty" title="Belum ada dataset" message="Dataset yang berhasil diunggah akan ditampilkan di sini." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Dataset</th><th>Periode</th><th>Baris awal</th><th>Baris bersih</th><th>Ditolak</th><th>Status</th><th>Tanggal dibuat</th><th /></tr></thead><tbody>{datasets.data.map((item) => <tr key={item.id}><td><strong>{item.dataset_name}</strong><small className="table-sub">{item.source_name} · #{item.id}</small></td><td>{item.start_date} — {item.end_date}</td><td>{formatNumber(item.raw_row_count)}</td><td>{formatNumber(item.cleaned_row_count)}</td><td>{formatNumber(item.rejected_row_count)}</td><td><StatusBadge status={item.status} /></td><td>{formatDate(item.created_at)}</td><td><div className="table-actions"><button className="text-button" onClick={() => setSelectedDatasetId(item.id)}><Database size={13} /> Pilih</button><button className="text-button" onClick={() => void showDetail(item.id)}>Rincian</button></div></td></tr>)}</tbody></table></div>}
    </GlassCard>
    {detailDatasetId !== null && <GlassCard title={`Rincian dataset #${detailDatasetId}`} subtitle="Informasi dataset yang dipilih." action={<button className="icon-button" onClick={() => { setDetailDatasetId(null); setDetail(null); }} aria-label="Tutup rincian">×</button>}>{detailLoading ? <StatePanel type="loading" title="Memuat rincian" message="Mengambil informasi dataset." /> : detailError ? <StatePanel type="error" title="Rincian tidak tersedia" message={detailError} /> : <RecordDetails record={detail || {}} />}</GlassCard>}
  </div>;
}
