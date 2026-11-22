import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, FileWarning, Info, UploadCloud } from 'lucide-react';
import { getDatasets, validateDataset } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { GlassCard, PageHeader, PrimaryButton, SimulationTag, StatePanel, StatusBadge, formatNumber, RecordDetails } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import type { DatasetValidationResult } from '../../types/domain';

const checks = [
  ['Struktur CSV', 'Header wajib: ID kejadian · tanggal · latitude · longitude · magnitudo · kedalaman · lokasi.'],
  ['Identitas kejadian', 'ID kejadian wajib diisi dan harus unik dalam berkas. Format teks yang diterima: UTF-8 atau UTF-8-SIG.'],
  ['Rentang penelitian', 'Periode 2021–2025; latitude -15 sampai 10 dan longitude 90 sampai 145.'],
  ['Koordinat dan waktu', 'Koordinat numerik; tanggal menggunakan ISO-8601 dengan zona waktu/offset.'],
  ['Magnitudo dan kedalaman', 'Magnitudo harus berupa angka dan ≥ 0. Kedalaman boleh kosong; jika diisi harus berupa angka dan ≥ 0.'],
  ['Lokasi', 'Header kolom lokasi wajib ada, tetapi nilai lokasi boleh kosong.'],
];

export function ValidationPage() {
  const datasets = useResource(getDatasets, []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DatasetValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || IS_PREVIEW_MODE) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const validation = await validateDataset(file);
      setResult(validation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pemeriksaan berkas CSV gagal.');
      // Rincian teknis tetap disimpan untuk pemeriksaan, tetapi tidak ditampilkan kepada pengguna.
    } finally { setBusy(false); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / KUALITAS DATA" title="Validasi Dataset" description="Periksa kesesuaian berkas CSV sebelum didaftarkan sebagai dataset." action={<SimulationTag />} />
    <div className="validation-callout"><Info size={18} /><div><strong>Pemeriksaan ini tidak menyimpan dataset.</strong><span>Sistem memeriksa berkas sementara, menampilkan hasil pemeriksaan, lalu menghapus berkas sementara. Aktivitas pemeriksaan tetap tercatat pada Log Aktivitas.</span></div></div>

    <GlassCard title="Validasi CSV" subtitle="Pilih berkas hasil prapemrosesan dari Jupyter Notebook. Berkas tidak disimpan sebagai dataset pada tahap pemeriksaan ini.">
      <form className="stack-form" onSubmit={submit}>
        <label className={`file-drop ${file ? 'file-selected' : ''}`}>
          <input type="file" accept=".csv,text/csv" disabled={IS_PREVIEW_MODE || busy} onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); setError(null); }} />
          <span className="file-drop-icon"><UploadCloud size={23} /></span>
          <strong>{file?.name || 'Pilih berkas CSV untuk diperiksa'}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Hanya berkas CSV hasil prapemrosesan'}</small>
        </label>
        {IS_PREVIEW_MODE && <div className="inline-notice"><Info size={15} />Mode Pratinjau: pemeriksaan langsung ke server dinonaktifkan.</div>}
        {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
        {result && <div className="validation-result">
          <div className="success-panel"><CheckCircle2 size={18} /><div><strong>{result.valid === true ? 'Berkas memenuhi aturan pemeriksaan' : 'Hasil pemeriksaan diterima'}</strong><span>{result.filename || file?.name || 'CSV'} · {formatNumber(result.row_count)} baris · Berkas disimpan: {result.persisted ? 'Ya' : 'Tidak'}</span></div></div>
          <div className="validation-result-grid"><div><span>Dataset disimpan</span><strong>Tidak — hanya pemeriksaan</strong></div></div>
          <div className="required-columns"><span>Kolom yang diperiksa</span><div>{(result.required_columns || []).map((column) => <code key={column}>{({ event_id: 'ID kejadian', tanggal: 'Tanggal', latitude: 'Latitude', longitude: 'Longitude', magnitude: 'Magnitudo', kedalaman: 'Kedalaman', lokasi: 'Lokasi' } as Record<string, string>)[column] || column}</code>)}</div></div>
          {Object.keys(result.rules || {}).length > 0 && <details className="detail-disclosure"><summary>Rincian aturan pemeriksaan</summary><RecordDetails record={result.rules || {}} /></details>}
        </div>}
        <PrimaryButton type="submit" disabled={IS_PREVIEW_MODE || busy || !file}>{busy ? 'Memvalidasi CSV…' : 'Periksa Berkas CSV'}</PrimaryButton>
      </form>
    </GlassCard>

    <GlassCard title="Aturan Pemeriksaan Dataset" subtitle="Berkas ditolak jika ditemukan baris yang tidak sesuai. Aplikasi tidak membersihkan atau mengubah baris secara otomatis.">
      <div className="validation-checks">{checks.map(([title, description], index) => <div className="validation-check" key={title}><span className="validation-index">0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div><CheckCircle2 size={17} /></div>)}</div>
      <p className="subtle-copy">Nama kolom pada berkas CSV harus ditulis persis seperti berikut:</p><div className="code-field">event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</div>
    </GlassCard>

    <GlassCard title="Dataset Terdaftar" subtitle="Daftar dataset yang sudah berhasil disimpan.">
      {datasets.loading ? <StatePanel type="loading" title="Memuat dataset" message="Mengambil data dataset." /> : datasets.error ? <StatePanel type="error" title="Dataset belum tersedia" message={datasets.error} /> : !datasets.data?.length ? <StatePanel type="empty" title="Belum ada dataset" message="Dataset akan muncul setelah upload berhasil." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Dataset</th><th>Baris bersih</th><th>Status</th></tr></thead><tbody>{datasets.data.map((item) => <tr key={item.id}><td><strong>{item.dataset_name}</strong><small className="table-sub">#{item.id} · {item.source_name}</small></td><td>{formatNumber(item.cleaned_row_count)}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>}
    </GlassCard>
    <div className="admin-note"><FileWarning size={16} /><span>Hasil pemeriksaan menunjukkan apakah berkas memenuhi aturan sistem. Hasil ini tidak menggantikan audit kualitas data, dokumentasi prapemrosesan, atau persetujuan metodologi.</span></div>
  </div>;
}
