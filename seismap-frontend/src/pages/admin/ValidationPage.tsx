import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, FileWarning, Info, UploadCloud } from 'lucide-react';
import { validateDataset } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { GlassCard, PageHeader, PrimaryButton, SimulationTag, formatNumber, RecordDetails } from '../../components/ui';
import type { DatasetValidationResult } from '../../types/domain';

const checks = [
  ['Struktur CSV', 'Header wajib: event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi.'],
  ['Identitas kejadian', 'ID kejadian wajib diisi dan harus unik dalam file. Format teks yang diterima: UTF-8 atau UTF-8-SIG.'],
  ['Rentang penelitian', 'Periode 2021–2025; latitude -15 sampai 10 dan longitude 90 sampai 145.'],
  ['Koordinat dan waktu', 'Koordinat numerik; tanggal menggunakan ISO-8601 dengan zona waktu/offset.'],
  ['Magnitudo dan kedalaman', 'Magnitudo harus berupa angka dan ≥ 0. Kedalaman boleh kosong; jika diisi harus berupa angka dan ≥ 0.'],
  ['Lokasi', 'Header kolom lokasi wajib ada, tetapi nilai lokasi boleh kosong.'],
];

export function ValidationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DatasetValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || IS_PREVIEW_MODE) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const validation = await validateDataset(file);
      setResult(validation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pemeriksaan file CSV gagal.');
      // Rincian teknis tetap disimpan untuk pemeriksaan, tetapi tidak ditampilkan kepada pengguna.
    } finally { setBusy(false); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow="ADMIN / KUALITAS DATA" title="Validasi Dataset" description="Periksa kesesuaian file CSV sebelum didaftarkan sebagai dataset." action={<SimulationTag />} />

    <GlassCard title="Validasi CSV" subtitle="Pemeriksaan bersifat sementara dan tidak otomatis menyimpan dataset.">
      <form className="stack-form" onSubmit={submit}>
        <label className={`file-drop ${file ? 'file-selected' : ''}`}>
          <input type="file" accept=".csv,text/csv" disabled={IS_PREVIEW_MODE || busy} onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); setError(null); }} />
          <span className="file-drop-icon"><UploadCloud size={23} /></span>
          <strong>{file?.name || 'Pilih file CSV untuk diperiksa'}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Hanya file CSV hasil prapemrosesan'}</small>
        </label>
        {IS_PREVIEW_MODE && <div className="inline-notice"><Info size={15} />Mode Pratinjau: pemeriksaan langsung ke server dinonaktifkan.</div>}
        {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
        {result && <div className="validation-result">
          <div className="success-panel"><CheckCircle2 size={18} /><div><strong>{result.valid === true ? 'File memenuhi aturan pemeriksaan' : 'Hasil pemeriksaan diterima'}</strong><span>{result.filename || file?.name || 'CSV'} · {formatNumber(result.row_count)} baris · File disimpan: {result.persisted ? 'Ya' : 'Tidak'}</span></div></div>
          {result.valid === true && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/admin/dataset" className="button button-secondary">
                Lanjut Unggah ke Dataset <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="validation-result-grid"><div><span>Dataset disimpan</span><strong>Tidak — hanya pemeriksaan</strong></div></div>
          <div className="required-columns"><span>Kolom yang diperiksa</span><div>{(result.required_columns || []).map((column) => <code key={column}>{({ event_id: 'ID kejadian', tanggal: 'Tanggal', latitude: 'Latitude', longitude: 'Longitude', magnitude: 'Magnitudo', kedalaman: 'Kedalaman', lokasi: 'Lokasi' } as Record<string, string>)[column] || column}</code>)}</div></div>
          {Object.keys(result.rules || {}).length > 0 && <details className="detail-disclosure"><summary>Rincian aturan pemeriksaan</summary><RecordDetails record={result.rules || {}} /></details>}
        </div>}
        <PrimaryButton type="submit" disabled={IS_PREVIEW_MODE || busy || !file}>{busy ? 'Memvalidasi CSV…' : 'Periksa File CSV'}</PrimaryButton>
      </form>
    </GlassCard>

    <GlassCard
      className={`validation-rules-card ${rulesOpen ? '' : 'is-collapsed'}`.trim()}
      title="Aturan Pemeriksaan Dataset"
      subtitle={rulesOpen ? 'File ditolak jika ditemukan baris yang tidak sesuai. Aplikasi tidak membersihkan atau mengubah baris secara otomatis.' : undefined}
      action={
        <button
          type="button"
          className="button button-secondary validation-rules-toggle"
          aria-expanded={rulesOpen}
          onClick={() => setRulesOpen((open) => !open)}
        >
          {rulesOpen ? <><ChevronUp size={14} /> Sembunyikan Aturan Validasi</> : <><ChevronDown size={14} /> Lihat Aturan Validasi</>}
        </button>
      }
    >
      {rulesOpen && (
        <>
          <div className="validation-checks">{checks.map(([title, description], index) => <div className="validation-check" key={title}><span className="validation-index">0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div><CheckCircle2 size={17} /></div>)}</div>
          <p className="subtle-copy">Nama kolom pada file CSV harus ditulis persis seperti berikut:</p><div className="code-field">event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</div>
        </>
      )}
    </GlassCard>
    <div className="admin-note"><FileWarning size={16} /><span>Hasil pemeriksaan menunjukkan apakah file memenuhi aturan sistem. Hasil ini tidak menggantikan audit kualitas data, dokumentasi prapemrosesan, atau persetujuan metodologi.</span></div>
  </div>;
}
