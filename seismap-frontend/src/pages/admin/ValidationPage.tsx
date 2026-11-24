import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, FileWarning, Info, UploadCloud } from 'lucide-react';
import { validateDataset } from '../../api/services';
import { IS_PREVIEW_MODE } from '../../config/env';
import { GlassCard, PageHeader, PrimaryButton, SimulationTag, formatNumber, RecordDetails } from '../../components/ui';
import { useI18n } from '../../i18n/LanguageContext';
import type { DatasetValidationResult } from '../../types/domain';

export function ValidationPage() {
  const { tx } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DatasetValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const checks = [
    [
      tx('Struktur CSV', 'CSV Structure'),
      tx('Header wajib: event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi.', 'Required headers: event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi.'),
    ],
    [
      tx('Identitas kejadian', 'Event Identity'),
      tx('ID kejadian wajib diisi dan harus unik dalam file. Format teks yang diterima: UTF-8 atau UTF-8-SIG.', 'event_id is required and must be unique in the file. Accepted text encodings: UTF-8 or UTF-8-SIG.'),
    ],
    [
      tx('Rentang penelitian', 'Research Bounds'),
      tx('Periode 2021–2025; latitude -15 sampai 10 dan longitude 90 sampai 145.', 'Period 2021–2025; latitude -15 to 10 and longitude 90 to 145.'),
    ],
    [
      tx('Koordinat dan waktu', 'Coordinates & Time'),
      tx('Koordinat numerik; tanggal menggunakan ISO-8601 dengan zona waktu/offset.', 'Numeric coordinates; dates must follow ISO-8601 with timezone/offset.'),
    ],
    [
      tx('Magnitudo dan kedalaman', 'Magnitude & Depth'),
      tx('Magnitudo harus berupa angka dan ≥ 0. Kedalaman boleh kosong; jika diisi harus berupa angka dan ≥ 0.', 'Magnitude must be numeric and ≥ 0. Depth is optional; when provided it must be numeric and ≥ 0.'),
    ],
    [
      tx('Lokasi', 'Location'),
      tx('Header kolom lokasi wajib ada, tetapi nilai lokasi boleh kosong.', 'The lokasi column header is required, though row values may be empty.'),
    ],
  ];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || IS_PREVIEW_MODE) return;
    setBusy(true); setResult(null); setError(null);
    try {
      const validation = await validateDataset(file);
      setResult(validation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tx('Pemeriksaan file CSV gagal.', 'CSV validation failed.'));
    } finally { setBusy(false); }
  };

  return <div className="page-stack">
    <PageHeader eyebrow={tx('ADMIN / KUALITAS DATA', 'ADMIN / DATA QUALITY')} title={tx('Validasi Dataset', 'Dataset Validation')} description={tx('Periksa kesesuaian file CSV sebelum didaftarkan sebagai dataset.', 'Check CSV file compliance before registering it as a dataset.')} action={<SimulationTag />} />

    <GlassCard title={tx('Validasi CSV', 'CSV Validation')} subtitle={tx('Pemeriksaan bersifat sementara dan tidak otomatis menyimpan dataset.', 'Validation is temporary and does not automatically save the dataset.')}>
      <form className="stack-form" onSubmit={submit}>
        <label className={`file-drop ${file ? 'file-selected' : ''}`}>
          <input type="file" accept=".csv,text/csv" disabled={IS_PREVIEW_MODE || busy} onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); setError(null); }} />
          <span className="file-drop-icon"><UploadCloud size={23} /></span>
          <strong>{file?.name || tx('Pilih file CSV untuk diperiksa', 'Choose CSV file to validate')}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : tx('Hanya file CSV hasil prapemrosesan', 'Preprocessed CSV files only')}</small>
        </label>
        {IS_PREVIEW_MODE && <div className="inline-notice"><Info size={15} />{tx('Mode Pratinjau: pemeriksaan langsung ke server dinonaktifkan.', 'Preview Mode: live server validation is disabled.')}</div>}
        {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
        {result && <div className="validation-result">
          <div className="success-panel"><CheckCircle2 size={18} /><div><strong>{result.valid === true ? tx('File memenuhi aturan pemeriksaan', 'File passed validation rules') : tx('Hasil pemeriksaan diterima', 'Validation result received')}</strong><span>{result.filename || file?.name || 'CSV'} · {formatNumber(result.row_count)} {tx('baris', 'rows')} · {tx('File disimpan:', 'File saved:')} {result.persisted ? tx('Ya', 'Yes') : tx('Tidak', 'No')}</span></div></div>
          {result.valid === true && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/admin/dataset" className="button button-secondary">
                {tx('Lanjut Unggah ke Dataset', 'Proceed to Dataset Upload')} <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="validation-result-grid"><div><span>{tx('Dataset disimpan', 'Dataset saved')}</span><strong>{tx('Tidak — hanya pemeriksaan', 'No — validation only')}</strong></div></div>
          <div className="required-columns"><span>{tx('Kolom yang diperiksa', 'Checked columns')}</span><div>{(result.required_columns || []).map((column) => <code key={column}>{tx(({ event_id: 'ID kejadian', tanggal: 'Tanggal', latitude: 'Latitude', longitude: 'Longitude', magnitude: 'Magnitudo', kedalaman: 'Kedalaman', lokasi: 'Lokasi' } as Record<string, string>)[column] || column, column)}</code>)}</div></div>
          {Object.keys(result.rules || {}).length > 0 && <details className="detail-disclosure"><summary>{tx('Rincian aturan pemeriksaan', 'Validation rule details')}</summary><RecordDetails record={result.rules || {}} /></details>}
        </div>}
        <PrimaryButton type="submit" disabled={IS_PREVIEW_MODE || busy || !file}>{busy ? tx('Memvalidasi CSV…', 'Validating CSV…') : tx('Periksa File CSV', 'Validate CSV File')}</PrimaryButton>
      </form>
    </GlassCard>

    <GlassCard
      className={`validation-rules-card ${rulesOpen ? '' : 'is-collapsed'}`.trim()}
      title={tx('Aturan Pemeriksaan Dataset', 'Dataset Validation Rules')}
      subtitle={rulesOpen ? tx('File ditolak jika ditemukan baris yang tidak sesuai. Aplikasi tidak membersihkan atau mengubah baris secara otomatis.', 'Files are rejected if non-compliant rows are found. Rows are never altered silently.') : undefined}
      action={
        <button
          type="button"
          className="button button-secondary validation-rules-toggle"
          aria-expanded={rulesOpen}
          onClick={() => setRulesOpen((open) => !open)}
        >
          {rulesOpen ? <><ChevronUp size={14} /> {tx('Sembunyikan Aturan Validasi', 'Hide Validation Rules')}</> : <><ChevronDown size={14} /> {tx('Lihat Aturan Validasi', 'Show Validation Rules')}</>}
        </button>
      }
    >
      {rulesOpen && (
        <>
          <div className="validation-checks">{checks.map(([title, description], index) => <div className="validation-check" key={title}><span className="validation-index">0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div><CheckCircle2 size={17} /></div>)}</div>
          <p className="subtle-copy">{tx('Nama kolom pada file CSV harus ditulis persis seperti berikut:', 'CSV column names must match the exact spelling below:')}</p><div className="code-field">event_id, tanggal, latitude, longitude, magnitude, kedalaman, lokasi</div>
        </>
      )}
    </GlassCard>
    <div className="admin-note"><FileWarning size={16} /><span>{tx('Hasil pemeriksaan menunjukkan apakah file memenuhi aturan sistem. Hasil ini tidak menggantikan audit kualitas data, dokumentasi prapemrosesan, atau persetujuan metodologi.', 'Validation checks confirm system schema compliance only and do not replace methodological review.')}</span></div>
  </div>;
}
