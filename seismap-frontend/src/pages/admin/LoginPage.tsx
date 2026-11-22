import { useState, type FormEvent } from 'react';
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { IS_PREVIEW_MODE } from '../../config/env';
import { StatePanel } from '../../components/ui';

export function LoginPage() {
  const { signIn, authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!IS_PREVIEW_MODE && loading) return <div className="login-loading">Memeriksa sesi admin…</div>;
  if (!IS_PREVIEW_MODE && authenticated) return <Navigate to="/admin" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { await signIn(identity, password); navigate('/admin'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal masuk. Silakan periksa email atau nama pengguna dan kata sandi.'); }
    finally { setBusy(false); }
  };

  return <div className="login-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><Link to="/" className="login-back"><ArrowLeft size={15} /> Kembali ke SEISMAP</Link><div className="login-card glass-panel">
    <div className="login-brand"><span className="brand-mark"><Activity size={22} /></span><div><strong>SEISMAP</strong><small>AKSES ADMINISTRATOR</small></div></div>
    <div className="login-heading"><span className="eyebrow">AREA KHUSUS ADMIN</span><h1>Selamat datang kembali.</h1><p>Masuk untuk mengelola dataset dan proses analisis penelitian.</p></div>
    {IS_PREVIEW_MODE ? <><StatePanel type="info" title="Mode Pratinjau aktif" message="Autentikasi tidak dijalankan. Halaman admin dapat dibuka untuk pemeriksaan tampilan; seluruh operasi perubahan data dinonaktifkan." /><button className="button button-primary button-full" onClick={() => navigate('/admin')}>Buka Pratinjau Admin <ArrowRight size={16} /></button></> : <form onSubmit={submit} className="login-form"><label>Email / Nama Pengguna<input autoComplete="username" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="admin@seismap.id" required /></label><label>Kata Sandi<div className="password-wrap"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label="Tampilkan kata sandi">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk ke Ruang Kerja'} <ArrowRight size={16} /></button></form>}
    <div className="login-security"><ShieldCheck size={15} /><span><LockKeyhole size={12} /> Area administrator terlindungi</span></div>
  </div><div className="login-footnote">SEISMAP · Pemetaan dan Analisis Gempa Indonesia</div></div>;
}
