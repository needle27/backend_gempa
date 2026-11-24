import { useState, type FormEvent } from 'react';
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useAuth } from '../../context/AuthContext';
import { IS_PREVIEW_MODE } from '../../config/env';
import { StatePanel } from '../../components/ui';
import { useI18n } from '../../i18n/LanguageContext';

export function LoginPage() {
  const { signIn, authenticated, loading } = useAuth();
  const { t, tx } = useI18n();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!IS_PREVIEW_MODE && loading) return <div className="login-loading">{tx('Memeriksa sesi admin…', 'Checking admin session…')}</div>;
  if (!IS_PREVIEW_MODE && authenticated) return <Navigate to="/admin" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { await signIn(identity, password); navigate('/admin'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : tx('Gagal masuk. Silakan periksa email atau nama pengguna dan kata sandi.', 'Sign-in failed. Verify your email or username and password.')); }
    finally { setBusy(false); }
  };

  return <div className="login-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><Link to="/" className="login-back"><ArrowLeft size={15} /> {tx('Kembali ke SEISMAP', 'Back to SEISMAP')}</Link><div className="login-lang-toggle"><LanguageToggle /></div><div className="login-card glass-panel">
    <div className="login-brand"><span className="brand-mark"><Activity size={22} /></span><div><strong>SEISMAP</strong><small>{tx('AKSES ADMINISTRATOR', 'ADMINISTRATOR ACCESS')}</small></div></div>
    <div className="login-heading"><span className="eyebrow">{tx('AREA KHUSUS ADMIN', 'RESTRICTED ADMIN AREA')}</span><h1>{tx('Selamat datang kembali.', 'Welcome back.')}</h1><p>{tx('Masuk untuk mengelola dataset dan proses analisis penelitian.', 'Sign in to manage research datasets and analysis pipelines.')}</p></div>
    {IS_PREVIEW_MODE ? <><StatePanel type="info" title={tx('Mode Pratinjau aktif', 'Preview Mode active')} message={tx('Autentikasi tidak dijalankan. Halaman admin dapat dibuka untuk pemeriksaan tampilan; seluruh operasi perubahan data dinonaktifkan.', 'Authentication is skipped in Preview Mode. Admin screens can be inspected, while write operations remain disabled.')} /><button className="button button-primary button-full" onClick={() => navigate('/admin')}>{tx('Buka Pratinjau Admin', 'Open Admin Preview')} <ArrowRight size={16} /></button></> : <form onSubmit={submit} className="login-form"><label>{tx('Email / Nama Pengguna', 'Email / Username')}<input autoComplete="username" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="admin@seismap.id" required /></label><label>{tx('Kata Sandi', 'Password')}<div className="password-wrap"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tx('Masukkan kata sandi', 'Enter your password')} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={tx('Tampilkan kata sandi', 'Show password')}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? tx('Memproses…', 'Processing…') : tx('Masuk ke Ruang Kerja', 'Sign In to Workspace')} <ArrowRight size={16} /></button></form>}
    <div className="login-security"><ShieldCheck size={15} /><span><LockKeyhole size={12} /> {tx('Area administrator terlindungi', 'Protected administrator area')}</span></div>
  </div><div className="login-footnote">{t.brand.loginFootnote}</div></div>;
}
